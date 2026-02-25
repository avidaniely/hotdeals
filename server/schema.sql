-- ============================================================
--  HOTדילים - MySQL Schema
--  Run: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS hotdeals CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotdeals;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  email       VARCHAR(120) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,          -- bcrypt hash
  avatar      VARCHAR(10)  NOT NULL DEFAULT '🙂',
  role        ENUM('user','admin') NOT NULL DEFAULT 'user',
  is_banned   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Categories ───────────────────────────────────────────────
CREATE TABLE categories (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO categories (name) VALUES
  ('אלקטרוניקה'),('אוכל ומשקאות'),('אופנה'),('נסיעות'),
  ('ספורט'),('בית וגינה'),('תינוקות'),('משחקים'),('בריאות');

-- ── Deals ────────────────────────────────────────────────────
CREATE TABLE deals (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT          NOT NULL,
  category_id    INT          NOT NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  url            VARCHAR(500),
  image_url      VARCHAR(500),
  store          VARCHAR(100),
  original_price DECIMAL(10,2),
  deal_price     DECIMAL(10,2) NOT NULL,
  is_approved    TINYINT(1)   NOT NULL DEFAULT 0,
  is_featured    TINYINT(1)   NOT NULL DEFAULT 0,
  is_expired     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ── Votes ────────────────────────────────────────────────────
CREATE TABLE votes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  deal_id    INT  NOT NULL,
  user_id    INT  NOT NULL,
  vote_type  ENUM('hot','cold') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vote (deal_id, user_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Comments ─────────────────────────────────────────────────
CREATE TABLE comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  deal_id    INT  NOT NULL,
  user_id    INT  NOT NULL,
  text       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Seed admin user (password: admin123) ─────────────────────
INSERT INTO users (username, email, password, avatar, role) VALUES
  ('admin', 'admin@hotdeals.co.il',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
   '👑', 'admin');
