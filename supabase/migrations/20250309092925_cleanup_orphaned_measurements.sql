-- Delete measurements that reference non-existent clients
DELETE FROM "Measurements"
WHERE client_id NOT IN (
    SELECT id
    FROM "Clients"
);
