UPDATE users 
SET password_hash = '$2a$10$LfKiC8/2rBa.Ggp7ITzDoOKVJb396VQ4Z9N7xoodpzxLoxQrT6bMO',
    updated_at = NOW()
WHERE email = 'kutubkothari@gmail.com';

SELECT email, full_name, plan FROM users WHERE email = 'kutubkothari@gmail.com';
