import requests

s = requests.Session()
# Login
res = s.post('http://localhost:5000/login', json={'username': 'admin', 'password': 'password'})
print("Login:", res.status_code, res.json())

# Test Chat
res = s.post('http://localhost:5000/api/chat', json={'query': 'Hello'})
print("Chat:", res.status_code, res.json())
