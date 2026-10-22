CREATE TABLE student (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(20), class_id INT) ENGINE=InnoDB;
CREATE TABLE class (id INT, title VARCHAR(20));
INSERT INTO student (name, class_id) VALUES ('Asha', 1), ('Ravi', 2), ('Meena', 1);
INSERT INTO class VALUES (1, 'CSE'), (2, 'ECE');
SELECT s.name, c.title FROM student s JOIN class c ON s.class_id = c.id ORDER BY s.name;
