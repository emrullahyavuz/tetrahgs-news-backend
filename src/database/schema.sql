-- Create Users table
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'writer')),
    status NVARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive')),
    lastLogin DATETIME,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME
);

-- Create Categories table
CREATE TABLE Categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    slug NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(500),
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME
);

-- Create News table
CREATE TABLE News (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    slug NVARCHAR(200) UNIQUE NOT NULL,
    summary NVARCHAR(500),
    content NTEXT NOT NULL,
    imageUrl NVARCHAR(255),
    status NVARCHAR(20) NOT NULL CHECK (status IN ('draft', 'published', 'review')),
    views INT DEFAULT 0,
    categoryId INT,
    authorId INT,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME,
    FOREIGN KEY (categoryId) REFERENCES Categories(id),
    FOREIGN KEY (authorId) REFERENCES Users(id)
);

-- Create Settings table
CREATE TABLE Settings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    [key] NVARCHAR(50) UNIQUE NOT NULL,
    value NTEXT,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME
);

-- Create indexes
CREATE INDEX IX_News_Slug ON News(slug);
CREATE INDEX IX_News_Status ON News(status);
CREATE INDEX IX_News_CategoryId ON News(categoryId);
CREATE INDEX IX_News_AuthorId ON News(authorId);
CREATE INDEX IX_Categories_Slug ON Categories(slug);
CREATE INDEX IX_Users_Email ON Users(email);

-- Insert default admin user
INSERT INTO Users (name, email, password, role, status, createdAt)
VALUES (
    'Admin User',
    'admin@teknohaber.com',
    -- Default password: admin123 (should be changed immediately)
    '$2a$10$XFE/UkHfpPD8VuBZzS89/.4L7Zj4setX0QaF9UeBwgGS6tX.Hd6.q',
    'admin',
    'active',
    GETDATE()
);

-- Insert default categories
INSERT INTO Categories (name, slug, description, createdAt)
VALUES 
    ('Yapay Zeka', 'yapay-zeka', 'Yapay zeka teknolojileri ve gelişmeleri', GETDATE()),
    ('Donanım', 'donanim', 'Bilgisayar ve elektronik donanım haberleri', GETDATE()),
    ('Yazılım', 'yazilim', 'Yazılım geliştirme ve uygulama haberleri', GETDATE()),
    ('Mobil', 'mobil', 'Mobil cihazlar ve uygulamalar', GETDATE()),
    ('Oyun', 'oyun', 'Video oyunları ve oyun teknolojileri', GETDATE());

-- Insert default settings
INSERT INTO Settings ([key], value, createdAt)
VALUES 
    ('site_title', 'TeknoHaber', GETDATE()),
    ('site_description', 'En güncel teknoloji haberleri', GETDATE()),
    ('contact_email', 'info@teknohaber.com', GETDATE()),
    ('posts_per_page', '12', GETDATE());

