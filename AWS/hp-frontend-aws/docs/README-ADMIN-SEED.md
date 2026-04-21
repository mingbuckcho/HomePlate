# 관리자 경기 생성 + 좌석 예매용 DB 시드

경기 생성/수정 시 **경기장·팀 ID**가, 좌석 선택 시 **구역·좌석 데이터**가 백엔드 DB에 있어야 합니다. 아래 순서로 넣으세요.

---

## 방법 1: Spring Boot 기동 시 자동 삽입 (권장)

1. **파일 복사**
   - `docs/data.sql` 내용을 그대로 복사해서
   - `hp-backend-main/api/src/main/resources/data.sql` 파일로 저장  
     (해당 경로에 `data.sql`이 없으면 새로 만들면 됩니다.)

2. **백엔드 재시작**
   - Spring Boot를 다시 실행하면, 기동 시 `data.sql`이 한 번 실행되어  
     `stadiums`, `teams` 테이블에 경기장·팀 데이터가 들어갑니다.
   - `application.yml`에 `defer-datasource-initialization: true`가 있어야 합니다 (이미 있으면 그대로 두면 됨).

3. **이후**
   - 관리자에서 구장/홈/원정 선택 후 경기 생성하면, 위에서 넣은 ID와 맞아서 정상 동작해야 합니다.

---

## 방법 2: MySQL에서 직접 실행

1. MySQL 클라이언트에서 `HomePlate` 스키마 사용:
   ```sql
   USE HomePlate;
   ```
2. `docs/seed-stadiums-teams.sql` 파일 내용을 그대로 실행합니다.
3. 백엔드 서버는 이미 켜져 있어도 되고, 껐다 켜도 됩니다.

---

## 전송 ID와 DB가 일치하는지 확인

에러 알림에 나오는 **전송한 ID**가 DB에 있어야 합니다.

- **stadiumId**: `JAMSIL`, `MUNHAK`, `SUWON`, `GWANGJU`, `DAEGU`, `SAJIK`, `CHANGWON`, `GOCHEOK` 중 하나
- **homeTeamId / awayTeamId**: 영문 통일 — `LG`, `KT`, `SSG`, `NC`, `DB`, `KIA`, `LT`, `SS`, `HH`, `KW` 중 하나

MySQL에서 확인:

```sql
USE HomePlate;
SELECT * FROM stadiums;
SELECT * FROM teams;
```

위와 같은 값이 들어 있어야 경기 생성이 됩니다.

---

## 좌석 선택이 되게 하려면 (구역·좌석 데이터)

경기를 **잠실(JAMSIL)** 로 생성했다면, 아래 시드를 실행하면 구역 101·201·202·301 과 좌석이 생깁니다.

1. **경기장·팀**이 이미 들어가 있는 상태에서
2. **`docs/seed-zones-seats.sql`** 실행 (MySQL에서 `USE HomePlate;` 후 파일 내용 실행)

이후 해당 경기에서 예매하기 → 대기열 → **구역 선택(101, 201, 202, 301)** → 좌석 선택이 가능합니다. 다른 구장도 쓰려면 동일 형식으로 `zones`/`seats` INSERT를 추가하면 됩니다.
