CREATE TABLE sales (region VARCHAR(10), amount INT);
INSERT INTO sales VALUES ('North', 100), ('South', 50), ('North', 70), ('East', NULL);
SELECT region, COUNT(amount) AS n, SUM(amount) AS total FROM sales GROUP BY region HAVING COUNT(*) >= 1 ORDER BY region;
