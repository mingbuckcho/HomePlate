-- ────────────────────────────────────────────────────────────────────
-- mariadb-init.sql
--
-- 역할:
--   로컬: docker-compose의 MariaDB 컨테이너 최초 생성 시 자동 실행
--   운영: DBA가 운영 MariaDB에 직접 실행
--
-- 주의:
--   MARIADB_DATABASE 환경변수를 사용하지 않는다
--   DB 생성을 이 파일이 직접 담당한다
--   이렇게 해야 로컬과 운영이 동일한 방식으로 초기화된다
-- ────────────────────────────────────────────────────────────────────

-- DB가 없으면 만든다
-- CHARACTER SET utf8mb4: 한글, 이모지 등 4바이트 유니코드를 지원한다
-- COLLATE utf8mb4_general_ci: 대소문자를 구분하지 않는 정렬 방식
CREATE DATABASE IF NOT EXISTS hp_serving
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE hp_serving;

-- ── 구단 테이블 ───────────────────────────────────────────────────────
-- KBO 10개 구단 + KBO 공식 = 총 11개
-- team_id는 영문 대문자 코드로 관리한다 (KIA, LG, SSG 등)
-- exporter.py의 TEAM_KEYWORDS가 이 team_id를 참조한다
CREATE TABLE IF NOT EXISTS teams (
  team_id   VARCHAR(10)  NOT NULL COMMENT '구단 코드 (예: KIA, LG, SSG)',
  team_name VARCHAR(50)  NOT NULL COMMENT '구단 한글명 (예: 기아 타이거즈)',
  team_logo VARCHAR(255) NULL     COMMENT '로고 이미지 MinIO 경로',
  PRIMARY KEY (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='KBO 10개 구단 + KBO 공식';

-- 구단 초기 데이터
-- INSERT IGNORE: 이미 같은 PK가 있으면 무시하고 넘어간다
-- 여러 번 실행해도 중복 삽입되지 않는다
INSERT IGNORE INTO teams (team_id, team_name, team_logo) VALUES
  ('KIA',     '기아 타이거즈',  NULL),
  ('SAMSUNG', '삼성 라이온즈',  NULL),
  ('LG',      'LG 트윈스',      NULL),
  ('DOOSAN',  '두산 베어스',    NULL),
  ('KT',      'KT 위즈',        NULL),
  ('SSG',     'SSG 랜더스',     NULL),
  ('LOTTE',   '롯데 자이언츠',  NULL),
  ('HANWHA',  '한화 이글스',    NULL),
  ('NC',      'NC 다이노스',    NULL),
  ('KIWOOM',  '키움 히어로즈',  NULL),
  ('KBO',     'KBO 공식',       NULL);

-- ── 뉴스 테이블 ──────────────────────────────────────────────────────
-- news_url이 자연키(중복 방지 기준)다
-- 같은 URL의 뉴스가 다시 수집되면 UPDATE한다 (ON DUPLICATE KEY UPDATE)
CREATE TABLE IF NOT EXISTS news (
  news_id        BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK (자동 증가)',
  news_title     VARCHAR(255) NOT NULL                COMMENT '뉴스 제목',
  news_url       VARCHAR(512) NOT NULL                COMMENT '뉴스 URL (중복 방지 기준)',
  news_thumbnail VARCHAR(512) NULL                    COMMENT 'MinIO 경로 또는 원본 URL',
  news_press     VARCHAR(50)  NULL                    COMMENT '언론사명 (예: OSEN, 스포츠조선)',
  published_at   DATETIME     NULL                    COMMENT '기사 발행 시각',
  created_at     DATETIME     NOT NULL                COMMENT 'DB 최초 저장 시각',
  PRIMARY KEY (news_id),
  -- URL 중복을 DB 레벨에서 막는다
  -- exporter.py의 ON DUPLICATE KEY UPDATE가 이 키를 사용한다
  UNIQUE KEY uk_news_url (news_url),
  -- 발행일 기준 정렬/검색이 많으므로 인덱스를 만든다
  KEY idx_news_published (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='수집된 네이버 KBO 뉴스';

-- ── 굿즈 테이블 ──────────────────────────────────────────────────────
-- goods_url이 자연키(중복 방지 기준)다
-- team_id는 exporter.py의 TEAM_KEYWORDS로 자동 매핑된다
CREATE TABLE IF NOT EXISTS goods (
  goods_id        BIGINT         NOT NULL AUTO_INCREMENT COMMENT 'PK (자동 증가)',
  team_id         VARCHAR(10)    NULL                    COMMENT '구단 코드 (NULL: 매핑 실패)',
  goods_name      VARCHAR(100)   NOT NULL                COMMENT '상품명',
  goods_price     DECIMAL(10, 0) NULL                    COMMENT '가격 (원화, 소수점 없음)',
  goods_thumbnail VARCHAR(512)   NULL                    COMMENT 'MinIO 경로 또는 원본 URL',
  goods_url       VARCHAR(512)   NOT NULL                COMMENT '상품 URL (중복 방지 기준)',
  created_at      DATETIME       NOT NULL                COMMENT 'DB 최초 저장 시각',
  PRIMARY KEY (goods_id),
  UNIQUE KEY uk_goods_url (goods_url),
  -- 구단별 굿즈 조회가 많으므로 인덱스를 만든다
  KEY idx_goods_team (team_id),
  -- 외래 키: team_id는 반드시 teams.team_id에 있어야 한다
  -- ON DELETE SET NULL: 구단이 삭제되면 team_id를 NULL로 바꾼다
  -- ON UPDATE CASCADE: 구단 코드가 바뀌면 자동으로 따라서 바꾼다
  CONSTRAINT fk_goods_team
    FOREIGN KEY (team_id) REFERENCES teams (team_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='수집된 KBO마켓 굿즈 상품';

-- ── 구장 테이블 ───────────────────────────────────────────────────────
-- 경기 일정(games)의 stadium_id가 참조하는 마스터 데이터
CREATE TABLE IF NOT EXISTS stadiums (
  stadium_id      VARCHAR(10)  NOT NULL COMMENT '구장 코드',
  stadium_address VARCHAR(255) NOT NULL COMMENT '구장 주소',
  stadium_name    VARCHAR(100) NOT NULL COMMENT '구장명',
  PRIMARY KEY (stadium_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='KBO 경기장 마스터';

-- 구장 초기 데이터
INSERT IGNORE INTO stadiums (stadium_id, stadium_address, stadium_name) VALUES
  ('CHANGWON', '경상남도 창원시 마산회원구 삼호로 63', '창원NC파크'),
  ('DAEGU',    '대구광역시 수성구 야구전설로 1',      '대구삼성라이온즈파크'),
  ('DAEJEON',  '대전광역시 중구 대종로 373',         '대전한화생명볼파크'),
  ('GOCHEOCK', '광주광역시 북구 서림로 10',          '고척스카이돔'),
  ('GWANGJU',  '광주광역시 북구 서림로 10',          '광주기아챔피언스필드'),
  ('INCHEON',  '인천광역시 미추홀구 매소홀로 618',   '인천SSG랜더스필드'),
  ('SAJIK',    '부산광역시 동래구 사직로 45',        '사직야구장'),
  ('SEOUL',    '서울특별시 송파구 올림픽로 25',      '서울종합운동장 야구장'),
  ('SUWON',    '경기도 수원시 장안구 경수대로 893',  '수원케이디위즈파크');

-- ── 경기 일정 테이블 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  game_id        BIGINT                                   NOT NULL AUTO_INCREMENT COMMENT 'PK (자동 증가)',
  game_start_at  DATETIME(6)                              NOT NULL COMMENT '경기 시작 시각',
  game_status    ENUM('SCHEDULED', 'OPEN', 'ENDED')       NOT NULL COMMENT '경기 상태',
  max_seats      INT(11)                                  NOT NULL DEFAULT 19200 COMMENT '최대 좌석 수',
  ticket_open_at VARCHAR(10)                              NOT NULL COMMENT '티켓 오픈일 (YYYY-MM-DD)',
  away_team      VARCHAR(10)                              NOT NULL COMMENT '원정팀',
  home_team      VARCHAR(10)                              NOT NULL COMMENT '홈팀',
  stadium_id     VARCHAR(10)                              NOT NULL COMMENT '구장 식별자',
  PRIMARY KEY (game_id),
  -- game_id는 자동증가 PK이고,
  -- 아래 자연키 유니크로 같은 경기의 중복 적재를 방지한다.
  UNIQUE KEY uk_games_natural (game_start_at, away_team, home_team, stadium_id),
  KEY idx_games_start (game_start_at),
  KEY idx_games_status (game_status),
  KEY idx_games_teams (home_team, away_team),
  CONSTRAINT fk_games_stadium
    FOREIGN KEY (stadium_id) REFERENCES stadiums (stadium_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='KBO 경기 일정';

-- ── Outbox 테이블 ────────────────────────────────────────────────────
-- Outbox 패턴의 핵심 테이블.
--
-- 동작 원리:
--   1. Exporter가 goods upsert와 같은 트랜잭션에서 여기에 INSERT한다.
--   2. Outbox Relay가 3초마다 이 테이블을 SELECT해서 Kafka에 produce한다.
--   3. produce 성공 후 processed=true로 업데이트한다.
--
-- SELECT FOR UPDATE SKIP LOCKED:
--   Relay를 여러 개 띄울 때 중복 처리를 막는 핵심 구문.
--   한 Relay가 특정 행을 처리하는 동안 다른 Relay는 그 행을 건너뛴다.
--
-- product_id (goods.goods_id):
--   Kafka key로 사용. URL은 바뀔 수 있지만 PK는 변하지 않는다.
CREATE TABLE IF NOT EXISTS goods_outbox (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  event_type   VARCHAR(50) NOT NULL                COMMENT '예: PRICE_CHANGE',
  product_id   BIGINT      NULL                    COMMENT 'goods_id. Kafka key로 사용',
  payload      JSON        NOT NULL                COMMENT '슬랙 메시지에 필요한 상세 데이터',
  processed    BOOLEAN     NOT NULL DEFAULT false  COMMENT 'Relay가 produce 완료했으면 true',
  processed_at DATETIME    NULL,
  created_at   DATETIME    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  -- processed=false인 행을 빠르게 찾기 위한 인덱스
  -- Relay가 ORDER BY created_at으로 오래된 것부터 처리하므로 created_at도 포함
  INDEX idx_goods_outbox_unprocessed (processed, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 권한 부여 ──────────────────────────────────────────────────────────
-- app 사용자에게 hp_serving DB의 모든 권한을 부여한다
-- %: 모든 호스트에서 접속 허용 (운영에서는 특정 IP로 제한하는 게 좋다)
GRANT ALL PRIVILEGES ON hp_serving.* TO 'app'@'%';
FLUSH PRIVILEGES;
