-- ============================================================
-- 구역(zones) + 좌석(seats) 임시 데이터 (백엔드 InitService 형식과 동일)
-- 실행 전에 stadiums, teams 가 있어야 함. (docs/seed-stadiums-teams.sql 또는 run-this-once.sql 먼저 실행)
-- MySQL: USE HomePlate; 후 이 파일 실행
-- ============================================================
-- zone_id = stadium_id + '-' + zone_number (예: JAMSIL-101)
-- seat_code = zone_number + '-' + 행 + 열 (예: 101-A1)
-- 백엔드 BookService.getSeatsOrThrow, getZoneStatus 등이 이 형식을 사용합니다.
-- ============================================================

-- 1. 구역 (zones) - 잠실 구장 기준, 테스트용 4개 구역
INSERT INTO zones (zone_id, stadium_id, zone_name, zone_number, zone_grade) VALUES
('JAMSIL-101', 'JAMSIL', 'PREMIUM-101', '101', 'PREMIUM'),
('JAMSIL-201', 'JAMSIL', 'BLUE-201', '201', 'BLUE'),
('JAMSIL-202', 'JAMSIL', 'BLUE-202', '202', 'BLUE'),
('JAMSIL-301', 'JAMSIL', 'ORANGE-301', '301', 'ORANGE')
ON DUPLICATE KEY UPDATE zone_name = VALUES(zone_name), zone_grade = VALUES(zone_grade);

-- 2. 좌석 (seats) - 구역당 12석 (행 A:2, B:4, C:6) × 4구역 = 48석
-- 101
INSERT INTO seats (zone_id, seat_row, seat_col, seat_code) VALUES
('JAMSIL-101', 'A', 1, '101-A1'), ('JAMSIL-101', 'A', 2, '101-A2'),
('JAMSIL-101', 'B', 1, '101-B1'), ('JAMSIL-101', 'B', 2, '101-B2'), ('JAMSIL-101', 'B', 3, '101-B3'), ('JAMSIL-101', 'B', 4, '101-B4'),
('JAMSIL-101', 'C', 1, '101-C1'), ('JAMSIL-101', 'C', 2, '101-C2'), ('JAMSIL-101', 'C', 3, '101-C3'), ('JAMSIL-101', 'C', 4, '101-C4'), ('JAMSIL-101', 'C', 5, '101-C5'), ('JAMSIL-101', 'C', 6, '101-C6')
ON DUPLICATE KEY UPDATE seat_code = VALUES(seat_code);
-- 201
INSERT INTO seats (zone_id, seat_row, seat_col, seat_code) VALUES
('JAMSIL-201', 'A', 1, '201-A1'), ('JAMSIL-201', 'A', 2, '201-A2'),
('JAMSIL-201', 'B', 1, '201-B1'), ('JAMSIL-201', 'B', 2, '201-B2'), ('JAMSIL-201', 'B', 3, '201-B3'), ('JAMSIL-201', 'B', 4, '201-B4'),
('JAMSIL-201', 'C', 1, '201-C1'), ('JAMSIL-201', 'C', 2, '201-C2'), ('JAMSIL-201', 'C', 3, '201-C3'), ('JAMSIL-201', 'C', 4, '201-C4'), ('JAMSIL-201', 'C', 5, '201-C5'), ('JAMSIL-201', 'C', 6, '201-C6')
ON DUPLICATE KEY UPDATE seat_code = VALUES(seat_code);
-- 202
INSERT INTO seats (zone_id, seat_row, seat_col, seat_code) VALUES
('JAMSIL-202', 'A', 1, '202-A1'), ('JAMSIL-202', 'A', 2, '202-A2'),
('JAMSIL-202', 'B', 1, '202-B1'), ('JAMSIL-202', 'B', 2, '202-B2'), ('JAMSIL-202', 'B', 3, '202-B3'), ('JAMSIL-202', 'B', 4, '202-B4'),
('JAMSIL-202', 'C', 1, '202-C1'), ('JAMSIL-202', 'C', 2, '202-C2'), ('JAMSIL-202', 'C', 3, '202-C3'), ('JAMSIL-202', 'C', 4, '202-C4'), ('JAMSIL-202', 'C', 5, '202-C5'), ('JAMSIL-202', 'C', 6, '202-C6')
ON DUPLICATE KEY UPDATE seat_code = VALUES(seat_code);
-- 301
INSERT INTO seats (zone_id, seat_row, seat_col, seat_code) VALUES
('JAMSIL-301', 'A', 1, '301-A1'), ('JAMSIL-301', 'A', 2, '301-A2'),
('JAMSIL-301', 'B', 1, '301-B1'), ('JAMSIL-301', 'B', 2, '301-B2'), ('JAMSIL-301', 'B', 3, '301-B3'), ('JAMSIL-301', 'B', 4, '301-B4'),
('JAMSIL-301', 'C', 1, '301-C1'), ('JAMSIL-301', 'C', 2, '301-C2'), ('JAMSIL-301', 'C', 3, '301-C3'), ('JAMSIL-301', 'C', 4, '301-C4'), ('JAMSIL-301', 'C', 5, '301-C5'), ('JAMSIL-301', 'C', 6, '301-C6')
ON DUPLICATE KEY UPDATE seat_code = VALUES(seat_code);

-- ※ 경기는 관리자에서 생성한 뒤, 해당 경기의 구장이 JAMSIL 이면 위 구역(101, 201, 202, 301)에서 좌석 선택 가능합니다.
--   다른 구장(MUNHAK, SUWON 등)도 쓰려면 동일 형식으로 zones/seats INSERT 추가하면 됩니다.
