SELECT 
    s.session_id, 
    s.name, 
    s.status,
    s.phone_number,
    s.api_key,
    u.email,
    u.plan
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.session_id = 'af2bbc2d-323d-4429-b653-455393d9f9e2';
