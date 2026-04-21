-- ============================================================
-- 경기 생성 실패 시 "한 번만" 실행하세요.
-- 백엔드 application.yml 의 DB와 동일해야 합니다. (기본: HomePlate)
-- ============================================================
-- 실행 방법 1: MySQL 클라이언트에서
--   USE HomePlate;
--   그 다음 이 파일 전체 복사해서 실행
--
-- 실행 방법 2: 터미널
--   mysql -u root -p HomePlate < docs/run-this-once.sql
-- ============================================================

INSERT INTO stadiums (stadium_id, stadium_name, stadium_location) VALUES
('JAMSIL', '잠실야구장', '서울 송파구'),
('MUNHAK', '문학야구장', '인천 미추홀구'),
('SUWON', '수원KT위즈파크', '경기 수원'),
('GWANGJU', '광주기아챔피언스필드', '광주 북구'),
('DAEGU', '대구삼성라이온즈파크', '대구 수성구'),
('SAJIK', '사직야구장', '부산 동구'),
('CHANGWON', '창원NC파크', '경남 창원'),
('GOCHEOK', '고척스카이돔', '서울 구로')
ON DUPLICATE KEY UPDATE stadium_name = VALUES(stadium_name), stadium_location = VALUES(stadium_location);

INSERT INTO teams (team_id, team_name, team_logo) VALUES
('LG', 'LG 트윈스', '/teams/LG.svg'),
('KT', 'KT 위즈', '/teams/KT.svg'),
('SSG', 'SSG 랜더스', '/teams/SSG.svg'),
('NC', 'NC 다이노스', '/teams/NC.svg'),
('DOOSAN', '두산 베어스', '/teams/DOOSAN.svg'),
('KIA', 'KIA 타이거즈', '/teams/KIA.svg'),
('LOTTE', '롯데 자이언츠', '/teams/LOTTE.svg'),
('SAMSUNG', '삼성 라이온즈', '/teams/SAMSUNG.svg'),
('HANWHA', '한화 이글스', '/teams/HANWHA.svg'),
('KIWOOM', '키움 히어로즈', '/teams/KIWOOM.svg')
ON DUPLICATE KEY UPDATE team_name = VALUES(team_name), team_logo = VALUES(team_logo);
