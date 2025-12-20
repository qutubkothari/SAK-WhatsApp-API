UPDATE users
SET plan = 'enterprise', updated_at = NOW()
WHERE email = 'kutubkothari@gmail.com';

SELECT email, plan
FROM users
WHERE email = 'kutubkothari@gmail.com';
