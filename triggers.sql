-- Триггеры для аудита операций в музыкальной библиотеке

-- Функция для аудита операций вставки
CREATE OR REPLACE FUNCTION audit_trigger_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (CURRENT_USER_ID(), 'INSERT', TG_TABLE_NAME, NEW.id, 
            jsonb_build_object('new_values', to_jsonb(NEW)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для аудита операций обновления
CREATE OR REPLACE FUNCTION audit_trigger_update()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (CURRENT_USER_ID(), 'UPDATE', TG_TABLE_NAME, OLD.id, 
            jsonb_build_object('old_values', to_jsonb(OLD), 'new_values', to_jsonb(NEW)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для аудита операций удаления
CREATE OR REPLACE FUNCTION audit_trigger_delete()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (CURRENT_USER_ID(), 'DELETE', TG_TABLE_NAME, OLD.id, 
            jsonb_build_object('old_values', to_jsonb(OLD)));
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения текущего ID пользователя (временно используем простую реализацию)
CREATE OR REPLACE FUNCTION CURRENT_USER_ID()
RETURNS INTEGER AS $$
BEGIN
    -- В реальной системе это будет получать ID текущего пользователя из сессии
    -- Пока возвращаем 1 как временный ID для демонстрации
    RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для таблицы пользователей
CREATE OR REPLACE FUNCTION check_user_permissions()
RETURNS TRIGGER AS $$
DECLARE
    current_user_role VARCHAR(20);
BEGIN
    -- Получаем роль текущего пользователя (в реальной системе из сессии)
    SELECT role INTO current_user_role FROM "user" WHERE user_id = NEW.user_id;
    
    -- Проверяем ограничения для обычных пользователей
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF current_user_role = 'user' AND OLD.user_id != NEW.user_id THEN
            RAISE EXCEPTION 'Пользователь может изменять только свои данные';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для ограничения доступа к трекам
CREATE OR REPLACE FUNCTION check_track_access()
RETURNS TRIGGER AS $$
DECLARE
    current_user_role VARCHAR(20);
    track_owner_id INT;
BEGIN
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        -- Получаем владельца трека
        IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
            SELECT user_id INTO track_owner_id FROM tracks WHERE track_id = OLD.track_id;
        ELSE
            SELECT user_id INTO track_owner_id FROM tracks WHERE track_id = NEW.track_id;
        END IF;
        
        -- Проверяем, является ли текущий пользователь владельцем или админом
        SELECT role INTO current_user_role FROM "user" WHERE user_id = track_owner_id;
        
        IF current_user_role = 'user' AND track_owner_id != OLD.user_id THEN
            RAISE EXCEPTION 'Пользователь может изменять только свои треки';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Дополнительные функции для обеспечения целостности данных

-- Функция для проверки, что BPM находится в разумном диапазоне
CREATE OR REPLACE FUNCTION validate_bpm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.bpm IS NOT NULL AND (NEW.bpm < 20 OR NEW.bpm > 300) THEN
        RAISE EXCEPTION 'BPM должен быть в диапазоне от 20 до 300';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки, что длительность положительна
CREATE OR REPLACE FUNCTION validate_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.duration_sec IS NOT NULL AND NEW.duration_sec <= 0 THEN
        RAISE EXCEPTION 'Длительность должна быть положительной';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создание триггеров для проверки данных
CREATE TRIGGER validate_track_bpm
    BEFORE INSERT OR UPDATE ON tracks
    FOR EACH ROW
    EXECUTE FUNCTION validate_bpm();

CREATE TRIGGER validate_track_duration
    BEFORE INSERT OR UPDATE ON tracks
    FOR EACH ROW
    EXECUTE FUNCTION validate_duration();

-- Триггер для автоматического создания системной коллекции "Любимые треки" при регистрации пользователя
CREATE OR REPLACE FUNCTION create_favorite_collection()
RETURNS TRIGGER AS $$
BEGIN
    -- Создаем системную коллекцию "Любимые треки" для нового пользователя
    INSERT INTO collections (user_id, name, is_favorite)
    VALUES (NEW.user_id, 'Любимые треки', TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического создания коллекции при добавлении пользователя
CREATE TRIGGER auto_create_favorite_collection
    AFTER INSERT ON "user"
    FOR EACH ROW
    EXECUTE FUNCTION create_favorite_collection();