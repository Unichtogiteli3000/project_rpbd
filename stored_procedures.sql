-- Хранимые процедуры для музыкальной библиотеки

-- Процедура для добавления нового пользователя
CREATE OR REPLACE FUNCTION add_user(
    p_login VARCHAR,
    p_password_hash TEXT,
    p_first_name VARCHAR DEFAULT NULL,
    p_last_name VARCHAR DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    new_user_id INTEGER;
BEGIN
    INSERT INTO "user" (login, password_hash, first_name, last_name, email, avatar_url)
    VALUES (p_login, p_password_hash, p_first_name, p_last_name, p_email, p_avatar_url)
    RETURNING user_id INTO new_user_id;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (new_user_id, 'INSERT', 'user', new_user_id, jsonb_build_object('login', p_login));
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для добавления нового жанра
CREATE OR REPLACE FUNCTION add_genre(p_name VARCHAR) RETURNS INTEGER AS $$
DECLARE
    new_genre_id INTEGER;
BEGIN
    INSERT INTO genres (name)
    VALUES (p_name)
    RETURNING genre_id INTO new_genre_id;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (NULL, 'INSERT', 'genres', new_genre_id, jsonb_build_object('name', p_name));
    
    RETURN new_genre_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для добавления нового исполнителя
CREATE OR REPLACE FUNCTION add_artist(p_name VARCHAR) RETURNS INTEGER AS $$
DECLARE
    new_artist_id INTEGER;
BEGIN
    INSERT INTO artists (name)
    VALUES (p_name)
    RETURNING artist_id INTO new_artist_id;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (NULL, 'INSERT', 'artists', new_artist_id, jsonb_build_object('name', p_name));
    
    RETURN new_artist_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для добавления нового трека
CREATE OR REPLACE FUNCTION add_track(
    p_title VARCHAR,
    p_artist_id INT,
    p_genre_id INT,
    p_bpm INT DEFAULT NULL,
    p_duration_sec INT DEFAULT NULL,
    p_user_id INT
) RETURNS INTEGER AS $$
DECLARE
    new_track_id INTEGER;
BEGIN
    INSERT INTO tracks (title, artist_id, genre_id, bpm, duration_sec, user_id)
    VALUES (p_title, p_artist_id, p_genre_id, p_bpm, p_duration_sec, p_user_id)
    RETURNING track_id INTO new_track_id;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (p_user_id, 'INSERT', 'tracks', new_track_id, 
            jsonb_build_object('title', p_title, 'artist_id', p_artist_id, 'genre_id', p_genre_id));
    
    RETURN new_track_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для добавления новой коллекции
CREATE OR REPLACE FUNCTION add_collection(
    p_user_id INT,
    p_name VARCHAR,
    p_is_favorite BOOLEAN DEFAULT FALSE
) RETURNS INTEGER AS $$
DECLARE
    new_collection_id INTEGER;
BEGIN
    INSERT INTO collections (user_id, name, is_favorite)
    VALUES (p_user_id, p_name, p_is_favorite)
    RETURNING collection_id INTO new_collection_id;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (p_user_id, 'INSERT', 'collections', new_collection_id, 
            jsonb_build_object('name', p_name, 'is_favorite', p_is_favorite));
    
    RETURN new_collection_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для добавления трека в коллекцию
CREATE OR REPLACE FUNCTION add_track_to_collection(
    p_collection_id INT,
    p_track_id INT
) RETURNS VOID AS $$
DECLARE
    track_owner_id INT;
    collection_owner_id INT;
BEGIN
    -- Проверяем, что трек и коллекция принадлежат одному пользователю или пользователь - админ
    SELECT user_id INTO track_owner_id FROM tracks WHERE track_id = p_track_id;
    SELECT user_id INTO collection_owner_id FROM collections WHERE collection_id = p_collection_id;
    
    IF track_owner_id != collection_owner_id THEN
        RAISE EXCEPTION 'Нельзя добавить трек в чужую коллекцию';
    END IF;
    
    INSERT INTO collection_tracks (collection_id, track_id)
    VALUES (p_collection_id, p_track_id);
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (collection_owner_id, 'INSERT', 'collection_tracks', NULL, 
            jsonb_build_object('collection_id', p_collection_id, 'track_id', p_track_id));
END;
$$ LANGUAGE plpgsql;

-- Процедура для получения всех треков пользователя
CREATE OR REPLACE FUNCTION get_user_tracks(p_user_id INT) RETURNS TABLE(
    track_id INT,
    title VARCHAR,
    artist_name VARCHAR,
    genre_name VARCHAR,
    bpm INT,
    duration_sec INT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE t.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для получения всех треков (только для администраторов)
CREATE OR REPLACE FUNCTION get_all_tracks(p_user_id INT) RETURNS TABLE(
    track_id INT,
    title VARCHAR,
    artist_name VARCHAR,
    genre_name VARCHAR,
    bpm INT,
    duration_sec INT,
    created_at TIMESTAMP,
    owner_login VARCHAR
) AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    SELECT role INTO user_role FROM "user" WHERE user_id = p_user_id;
    
    IF user_role != 'admin' THEN
        RAISE EXCEPTION 'Доступ запрещен: только администратор может просматривать все треки';
    END IF;
    
    RETURN QUERY
    SELECT t.track_id, t.title, ar.name, g.name, t.bpm, t.duration_sec, t.created_at, u.login
    FROM tracks t
    JOIN artists ar ON t.artist_id = ar.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    JOIN "user" u ON t.user_id = u.user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для поиска треков по критериям
CREATE OR REPLACE FUNCTION search_tracks(
    p_title VARCHAR DEFAULT NULL,
    p_artist_name VARCHAR DEFAULT NULL,
    p_genre_name VARCHAR DEFAULT NULL,
    p_min_bpm INT DEFAULT NULL,
    p_max_bpm INT DEFAULT NULL,
    p_user_id INT DEFAULT NULL
) RETURNS TABLE(
    track_id INT,
    title VARCHAR,
    artist_name VARCHAR,
    genre_name VARCHAR,
    bpm INT,
    duration_sec INT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE (p_title IS NULL OR t.title ILIKE '%' || p_title || '%')
      AND (p_artist_name IS NULL OR a.name ILIKE '%' || p_artist_name || '%')
      AND (p_genre_name IS NULL OR g.name ILIKE '%' || p_genre_name || '%')
      AND (p_min_bpm IS NULL OR t.bpm >= p_min_bpm)
      AND (p_max_bpm IS NULL OR t.bpm <= p_max_bpm)
      AND (p_user_id IS NULL OR t.user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Процедура для обновления трека (только владельца или администратора)
CREATE OR REPLACE FUNCTION update_track(
    p_track_id INT,
    p_user_id INT,
    p_title VARCHAR DEFAULT NULL,
    p_artist_id INT DEFAULT NULL,
    p_genre_id INT DEFAULT NULL,
    p_bpm INT DEFAULT NULL,
    p_duration_sec INT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    track_owner_id INT;
    user_role VARCHAR(20);
BEGIN
    SELECT user_id, (SELECT role FROM "user" WHERE user_id = p_user_id) 
    INTO track_owner_id, user_role
    FROM tracks WHERE track_id = p_track_id;
    
    -- Проверяем права: владелец или админ
    IF track_owner_id != p_user_id AND user_role != 'admin' THEN
        RAISE EXCEPTION 'Доступ запрещен: нельзя изменять чужой трек';
    END IF;
    
    UPDATE tracks SET
        title = COALESCE(p_title, title),
        artist_id = COALESCE(p_artist_id, artist_id),
        genre_id = COALESCE(p_genre_id, genre_id),
        bpm = COALESCE(p_bpm, bpm),
        duration_sec = COALESCE(p_duration_sec, duration_sec)
    WHERE track_id = p_track_id;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (p_user_id, 'UPDATE', 'tracks', p_track_id, 
            jsonb_build_object('title', p_title, 'artist_id', p_artist_id, 'genre_id', p_genre_id));
END;
$$ LANGUAGE plpgsql;

-- Процедура для удаления трека (только владельца или администратора)
CREATE OR REPLACE FUNCTION delete_track(
    p_track_id INT,
    p_user_id INT
) RETURNS VOID AS $$
DECLARE
    track_owner_id INT;
    user_role VARCHAR(20);
BEGIN
    SELECT user_id, (SELECT role FROM "user" WHERE user_id = p_user_id) 
    INTO track_owner_id, user_role
    FROM tracks WHERE track_id = p_track_id;
    
    -- Проверяем права: владелец или админ
    IF track_owner_id != p_user_id AND user_role != 'admin' THEN
        RAISE EXCEPTION 'Доступ запрещен: нельзя удалить чужой трек';
    END IF;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (p_user_id, 'DELETE', 'tracks', p_track_id, 
            jsonb_build_object('track_id', p_track_id));
    
    DELETE FROM tracks WHERE track_id = p_track_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для получения профиля пользователя
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id INT) RETURNS TABLE(
    login VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    email VARCHAR,
    avatar_url TEXT,
    created_at TIMESTAMP,
    favorite_genres TEXT[],
    favorite_artists TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.login,
        u.first_name,
        u.last_name,
        u.email,
        u.avatar_url,
        u.created_at,
        COALESCE(ARRAY(
            SELECT g.name 
            FROM user_favorite_genres ufg 
            JOIN genres g ON ufg.genre_id = g.genre_id 
            WHERE ufg.user_id = p_user_id
        ), '{}'),
        COALESCE(ARRAY(
            SELECT a.name 
            FROM user_favorite_artists ufa 
            JOIN artists a ON ufa.artist_id = a.artist_id 
            WHERE ufa.user_id = p_user_id
        ), '{}')
    FROM "user" u
    WHERE u.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для обновления профиля пользователя
CREATE OR REPLACE FUNCTION update_user_profile(
    p_user_id INT,
    p_first_name VARCHAR DEFAULT NULL,
    p_last_name VARCHAR DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE "user" SET
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        email = COALESCE(p_email, email),
        avatar_url = COALESCE(p_avatar_url, avatar_url)
    WHERE user_id = p_user_id;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (p_user_id, 'UPDATE', 'user', p_user_id, 
            jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name));
END;
$$ LANGUAGE plpgsql;

-- Процедура для добавления любимого жанра
CREATE OR REPLACE FUNCTION add_favorite_genre(
    p_user_id INT,
    p_genre_id INT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO user_favorite_genres (user_id, genre_id)
    VALUES (p_user_id, p_genre_id)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (p_user_id, 'INSERT', 'user_favorite_genres', NULL, 
            jsonb_build_object('genre_id', p_genre_id));
END;
$$ LANGUAGE plpgsql;

-- Процедура для добавления любимого исполнителя
CREATE OR REPLACE FUNCTION add_favorite_artist(
    p_user_id INT,
    p_artist_id INT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO user_favorite_artists (user_id, artist_id)
    VALUES (p_user_id, p_artist_id)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (p_user_id, 'INSERT', 'user_favorite_artists', NULL, 
            jsonb_build_object('artist_id', p_artist_id));
END;
$$ LANGUAGE plpgsql;

-- Процедура для получения всех коллекций пользователя
CREATE OR REPLACE FUNCTION get_user_collections(p_user_id INT) RETURNS TABLE(
    collection_id INT,
    name VARCHAR,
    is_favorite BOOLEAN,
    created_at TIMESTAMP,
    track_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.collection_id, 
        c.name, 
        c.is_favorite, 
        c.created_at,
        (SELECT COUNT(*) FROM collection_tracks ct WHERE ct.collection_id = c.collection_id) AS track_count
    FROM collections c
    WHERE c.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для получения треков в коллекции
CREATE OR REPLACE FUNCTION get_collection_tracks(p_collection_id INT, p_user_id INT) RETURNS TABLE(
    track_id INT,
    title VARCHAR,
    artist_name VARCHAR,
    genre_name VARCHAR,
    bpm INT,
    duration_sec INT
) AS $$
DECLARE
    collection_owner_id INT;
BEGIN
    -- Проверяем, что коллекция принадлежит пользователю или пользователь - админ
    SELECT user_id INTO collection_owner_id FROM collections WHERE collection_id = p_collection_id;
    
    IF collection_owner_id != p_user_id THEN
        SELECT role FROM "user" WHERE user_id = p_user_id INTO collection_owner_id;
        IF collection_owner_id != 'admin' THEN
            RAISE EXCEPTION 'Доступ запрещен: нельзя просматривать чужую коллекцию';
        END IF;
    END IF;
    
    RETURN QUERY
    SELECT 
        t.track_id, 
        t.title, 
        a.name, 
        g.name, 
        t.bpm, 
        t.duration_sec
    FROM collection_tracks ct
    JOIN tracks t ON ct.track_id = t.track_id
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE ct.collection_id = p_collection_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура для получения аудита операций (только для администраторов)
CREATE OR REPLACE FUNCTION get_audit_log(p_user_id INT) RETURNS TABLE(
    log_id INT,
    user_login VARCHAR,
    operation_type VARCHAR,
    table_name VARCHAR,
    record_id INT,
    operation_time TIMESTAMP,
    details JSONB
) AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    SELECT role INTO user_role FROM "user" WHERE user_id = p_user_id;
    
    IF user_role != 'admin' THEN
        RAISE EXCEPTION 'Доступ запрещен: только администратор может просматривать журнал аудита';
    END IF;
    
    RETURN QUERY
    SELECT 
        al.log_id,
        u.login,
        al.operation_type,
        al.table_name,
        al.record_id,
        al.operation_time,
        al.details
    FROM audit_log al
    LEFT JOIN "user" u ON al.user_id = u.user_id
    ORDER BY al.operation_time DESC;
END;
$$ LANGUAGE plpgsql;