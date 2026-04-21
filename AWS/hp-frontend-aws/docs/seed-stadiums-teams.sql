-- 백엔드 DB(HomePlate)에 경기장·팀 초기 데이터
-- MySQL에서: use HomePlate; 후 이 파일 실행 (또는 mysql -u root -p HomePlate < seed-stadiums-teams.sql)
--
-- ※ 프론트엔드 관리자 화면(구장/팀 드롭다운)과 반드시 동일한 ID를 사용합니다.
--    stadium_id: SEOUL, INCHEON, SUWON, GWANGJU, DAEGU, SAJIK, CHANGWON, GOCHEOCK, DAEJEON 등
--    team_id: LG, KT, SSG, NC, DOOSAN, KIA, LOTTE, SAMSUNG, HANWHA, KIWOOM

-- 1. 경기장 (stadiums) - 관리자 경기 생성 시 사용하는 stadium_id (한글명→ID 매핑은 프론트 STADIUM_NAME_TO_ID 참고)
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

-- 2. 구단 (teams) - 관리자 경기 생성 시 homeTeamId, awayTeamId 로 사용 (team_id = 실제 DB/백엔드와 동일)
-- team_logo: 프론트 public/teams/*.svg 경로 (더미 backend dump/img 사용 안 함)
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
