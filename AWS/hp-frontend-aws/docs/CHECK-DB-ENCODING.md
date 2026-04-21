# 한글 깨짐: DB vs 백엔드 구분

LG, KT는 보이는데 그 뒤 한글(트윈스, 위즈 등)만 깨지면 **DB에 저장된 값이 이미 잘못됐을 수** 있습니다.

## 1. DB부터 확인

MySQL에서:

```sql
USE HomePlate;
SELECT team_id, team_name FROM teams LIMIT 5;
SELECT stadium_id, stadium_name FROM stadiums LIMIT 3;
```

- 여기서 **한글이 이미 깨져 보이면** → **DB 문제**. 넣을 때 인코딩이 달랐음.
- 여기서 **한글이 정상**이면 → DB는 괜찮고, 백엔드에서 응답 쓸 때 인코딩을 더 손봐야 함.

## 2. DB가 깨진 경우 (한글이 이미 이상하게 저장됨)

- 시드/INSERT를 **UTF-8로 다시 실행**해야 함.
- 예: `mysql` 실행 시  
  `mysql -u root -p --default-character-set=utf8mb4 HomePlate < docs/seed-stadiums-teams.sql`
- 또는 클라이언트(Workbench, DBeaver 등)에서 연결/파일 인코딩을 **UTF-8**로 맞춘 뒤 스크립트 다시 실행.
- 실행 후 다시 위 `SELECT`로 한글이 정상인지 확인.

## 3. DB는 정상인데 화면만 깨지는 경우

- 그때는 백엔드 응답 인코딩을 추가로 손보면 됨 (필터로 `response.setCharacterEncoding("UTF-8")` 등).
