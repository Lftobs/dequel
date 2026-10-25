import type { DeployTemplate } from "../types";

export const wordPressTemplate: DeployTemplate = {
	key: "wordpress",
	name: "WordPress",
	description: "Content management system with PHP and MySQL backend, bundled with MariaDB.",
	category: "cms",
	docsUrl: "https://hub.docker.com/_/wordpress",
	service: "wordpress",
	port: 80,
	compose: `services:
  db:
    image: mariadb:11
    pull_policy: always
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD={MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE={MYSQL_DATABASE}
      - MYSQL_USER={MYSQL_USER}
      - MYSQL_PASSWORD={MYSQL_PASSWORD}
    volumes:
      - wp-db:/var/lib/mysql
  wordpress:
    image: wordpress:latest
    pull_policy: always
    restart: unless-stopped
    depends_on:
      - db
    environment:
      - WORDPRESS_DB_HOST=db
      - WORDPRESS_DB_NAME={MYSQL_DATABASE}
      - WORDPRESS_DB_USER={MYSQL_USER}
      - WORDPRESS_DB_PASSWORD={MYSQL_PASSWORD}
    volumes:
      - wp-content:/var/www/html
volumes:
  wp-db:
  wp-content:
`,
	vars: [
		{ key: "MYSQL_DATABASE", label: "Database name", default: "wordpress" },
		{ key: "MYSQL_USER", label: "Database user", default: "wordpress" },
		{ key: "MYSQL_ROOT_PASSWORD", label: "MariaDB root password", secret: true },
		{ key: "MYSQL_PASSWORD", label: "WordPress database password", secret: true },
	],
};
