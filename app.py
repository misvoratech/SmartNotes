import os
import json
import uuid
import datetime
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
import google.generativeai as genai
from dotenv import load_dotenv
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__, static_folder='static')
app.secret_key = os.getenv('SECRET_KEY', 'supersecretkey')
DATA_FILE = 'notes.json'
USERS_FILE = 'users.json'
SETTINGS_FILE = 'settings.json'

# --- Helper Functions ---

def get_data(filename, default):
    if not os.path.exists(filename):
        return default
    with open(filename, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default

def save_data(filename, data):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)

def get_notes():
    notes = get_data(DATA_FILE, [])
    # Migration: Assign stateless notes to admin
    migrated = False
    for note in notes:
        if 'owner' not in note:
            note['owner'] = 'admin'
            migrated = True
    if migrated:
        save_data(DATA_FILE, notes)
    return notes

def save_notes(notes):
    save_data(DATA_FILE, notes)

def get_users():
    return get_data(USERS_FILE, {}) 

def save_users(users):
    save_data(USERS_FILE, users)

def get_settings():
    return get_data(SETTINGS_FILE, {'creator_details': ''})

def save_settings(settings):
    save_data(SETTINGS_FILE, settings)

def validate_password(password, username):
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(char.isdigit() for char in password):
        return False, "Password must contain at least one number."
    if not any(char.isalpha() for char in password):
        return False, "Password must contain at least one letter."
    if not any(not char.isalnum() for char in password):
        return False, "Password must contain at least one special character."
    if username and username.lower() in password.lower():
        return False, "Password cannot contain your username."
    return True, ""

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated_function

# --- Routes ---

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'time' not in session and 'username' not in session: # Basic check
             return jsonify({'error': 'Unauthorized'}), 401
        
        # Check if user is admin
        if session.get('username') != 'admin':
             return jsonify({'error': 'Forbidden: Admin access required'}), 403
             
        return f(*args, **kwargs)
    return decorated_function

# --- Routes ---

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        data = request.json
        username = data.get('username')
        password = data.get('password')
        phone = data.get('phone', '') # Optional or required? Plan implies needed for recovery
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'})
        
        users = get_users()
        if username in users:
             return jsonify({'success': False, 'message': 'Username already exists'})
        
        is_valid, msg = validate_password(password, username)
        if not is_valid:
            return jsonify({'success': False, 'message': msg})

        users[username] = {
            'password': generate_password_hash(password),
            'phone': phone
        }
        save_users(users)
        return jsonify({'success': True})
        
    return send_from_directory('static', 'signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        users = get_users()
        
        isAdmin = False
        
        if username == 'admin':
             # Check if admin is in users file first
             if 'admin' in users:
                 user_data = users['admin']
                 # Schema Check: String vs Object
                 stored_hash = user_data if isinstance(user_data, str) else user_data.get('password')
                 
                 if check_password_hash(stored_hash, password):
                     isAdmin = True
                 else:
                     return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
             elif password == 'password': # Fallback legacy
                 isAdmin = True
             else:
                 return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
                 
             if isAdmin:
                 session['logged_in'] = True
                 session['username'] = 'admin'
                 return jsonify({'success': True, 'isAdmin': True})

        if username in users:
            user_data = users[username]
            # Schema Check: String vs Object
            stored_hash = user_data if isinstance(user_data, str) else user_data.get('password')
            
            if check_password_hash(stored_hash, password):
                session['logged_in'] = True
                session['username'] = username
                return jsonify({'success': True, 'isAdmin': False})
            
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    return send_from_directory('static', 'login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    session.pop('username', None)
    return redirect('/login')

@app.route('/')
@login_required
def home():
    return app.send_static_file('index.html')

@app.route('/admin')
@login_required
def admin_page():
    if session.get('username') != 'admin':
        return redirect('/')
    return app.send_static_file('admin.html')

@app.route('/<path:path>')
def serve_static(path):
    if path in ['login.html', 'login.js', 'signup.html', 'signup.js', 'style.css', 'admin.html', 'admin.js']:
         return send_from_directory('static', path)
    if 'logged_in' not in session:
         return redirect('/login')
    return send_from_directory('static', path)

# --- Admin API ---

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_stats():
    users = get_users()
    notes = get_notes()
    return jsonify({
        'user_count': len(users),
        'note_count': len(notes)
    })

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    users = get_users()
    # Return list of usernames. Don't send hashes.
    user_list = [{'username': u, 'role': 'Admin' if u == 'admin' else 'User'} for u in users.keys()]
    # If admin is not in file but logged in via legacy, add it
    if 'admin' not in users:
        user_list.append({'username': 'admin', 'role': 'Admin'})
        
    return jsonify(user_list)

@app.route('/api/admin/users/<username>', methods=['DELETE'])
@admin_required
def delete_user(username):
    if username == 'admin':
        return jsonify({'success': False, 'message': 'Cannot delete admin user'}), 400
        
    users = get_users()
    if username in users:
        del users[username]
        save_users(users)
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'User not found'}), 404

@app.route('/api/settings', methods=['GET'])
def get_public_settings():
    settings = get_settings()
    # Filter public settings if we had private ones, but for now just return all
    return jsonify(settings)

@app.route('/api/admin/settings', methods=['PUT'])
@admin_required
def update_settings():
    data = request.json
    settings = get_settings()
    
    # Update known fields
    if 'creator_details' in data:
        settings['creator_details'] = data['creator_details']
        
    save_settings(settings)
    return jsonify({'success': True})

@app.route('/api/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.json
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        return jsonify({'success': False, 'message': 'Missing fields'}), 400
        
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Unauthorized'}), 401
        
    users = get_users()
    
    is_valid = False
    
    # Check current password
    if username == 'admin': # Special handling for admin fallback/file
         if 'admin' in users:
             user_data = users['admin']
             stored_hash = user_data if isinstance(user_data, str) else user_data.get('password')
             if check_password_hash(stored_hash, old_password):
                 is_valid = True
         elif old_password == 'password':
             is_valid = True
             # If admin was legacy, we need to add to users file to support change
    elif username in users:
        user_data = users[username]
        stored_hash = user_data if isinstance(user_data, str) else user_data.get('password')
        if check_password_hash(stored_hash, old_password):
            is_valid = True
        
    if not is_valid:
         return jsonify({'success': False, 'message': 'Incorrect old password'}), 400
         
    is_valid_new, msg = validate_password(new_password, username)
    if not is_valid_new:
        return jsonify({'success': False, 'message': msg}), 400

    # Update password - Preserve phone if exists
    current_data = users.get(username)
    phone = ''
    if isinstance(current_data, dict):
        phone = current_data.get('phone', '')
    
    users[username] = {
        'password': generate_password_hash(new_password),
        'phone': phone
    }
    save_users(users)
    
    save_users(users)
    
    return jsonify({'success': True})

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    username = data.get('username')
    phone = data.get('phone')
    new_password = data.get('new_password')
    
    if not username or not phone or not new_password:
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
        
    users = get_users()
    if username not in users:
        return jsonify({'success': False, 'message': 'User not found'}), 404
        
    user_data = users[username]
    
    # Must be object schema to have phone
    if not isinstance(user_data, dict) or user_data.get('phone') != phone:
        return jsonify({'success': False, 'message': 'Invalid phone number for this account'}), 400
        
    # Validate new password
    is_valid, msg = validate_password(new_password, username)
    if not is_valid:
        return jsonify({'success': False, 'message': msg}), 400
        
    # Reset
    users[username]['password'] = generate_password_hash(new_password)
    save_users(users)
    
    return jsonify({'success': True})

@app.route('/api/notes', methods=['GET'])
@login_required
def list_notes():
    all_notes = get_notes()
    username = session.get('username')
    # Filter: User sees only their notes
    user_notes = [n for n in all_notes if n.get('owner') == username]
    return jsonify(user_notes)

@app.route('/api/notes', methods=['POST'])
@login_required
def create_note():
    data = request.json
    all_notes = get_notes()
    new_note = {
        'id': str(uuid.uuid4()),
        'title': data.get('title', 'Untitled'),
        'content': data.get('content', ''),
        'updatedAt': datetime.datetime.now().isoformat(),
        'owner': session.get('username')
    }
    all_notes.append(new_note)
    save_notes(all_notes)
    return jsonify(new_note)

@app.route('/api/notes/<note_id>', methods=['PUT'])
@login_required
def update_note(note_id):
    data = request.json
    all_notes = get_notes()
    username = session.get('username')
    
    for note in all_notes:
        if note['id'] == note_id:
            # Check ownership
            if note.get('owner') != username:
                return jsonify({'error': 'Forbidden'}), 403
                
            note['title'] = data.get('title', note['title'])
            note['content'] = data.get('content', note['content'])
            note['updatedAt'] = datetime.datetime.now().isoformat()
            save_notes(all_notes)
            return jsonify(note)
    return jsonify({'error': 'Note not found'}), 404

@app.route('/api/notes/<note_id>', methods=['DELETE'])
@login_required
def delete_note(note_id):
    all_notes = get_notes()
    username = session.get('username')
    
    # Filter out the note if it belongs to user
    new_notes = [n for n in all_notes if not (n['id'] == note_id and n.get('owner') == username)]
    
    if len(new_notes) == len(all_notes):
        # Nothing changed, either not found or not owned
        # We can just return success or error, let's treat strictly
        # But for idempotency, success is fine if it's already gone
        pass

    save_notes(new_notes)
    return jsonify({'success': True})

@app.route('/api/chat', methods=['POST'])
@login_required
def chat_ai():
    data = request.json
    user_query = data.get('query')
    all_notes = get_notes()
    username = session.get('username')
    
    # Filter: AI sees only user's notes
    user_notes = [n for n in all_notes if n.get('owner') == username]
    
    # Prepare context
    context = "\n\n".join([f"Title: {n['title']}\nContent: {n['content']}" for n in user_notes])
    
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'answer': "⚠️ API Key missing. Please set GEMINI_API_KEY in a .env file."})
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
        You are a smart assistant for a note-taking app.
        Here are the user's notes:
        ---
        {context}
        ---
        
        User Question: {user_query}
        
        Instructions:
        1. Answer based ONLY on the notes provided.
        2. If the answer isn't in the notes, say "I couldn't find that in your notes."
        3. Use Markdown formatting for a nice display.
        """
        
        response = model.generate_content(prompt)
        return jsonify({'answer': response.text})
    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify({'answer': f"AI Error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
