import pymysql
from .config import MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD


def get_conn():
    """
    MariaDB에 접속하고 연결 객체를 반환한다.

    autocommit=False:
        트랜잭션을 수동으로 관리한다.
        INSERT/UPDATE 후 conn.commit()을 호출해야 실제로 저장된다.
        에러 발생 시 conn.rollback()으로 되돌릴 수 있다.
        autocommit=True로 하면 매 쿼리가 즉시 커밋되어
        에러 발생 시 일부만 저장된 상태가 될 수 있다.

    DictCursor:
        SELECT 결과를 딕셔너리로 반환한다.
        row[0], row[1] 대신 row['news_title'] 처럼 컬럼명으로 접근할 수 있다.

    charset="utf8mb4":
        한글, 이모지 등 4바이트 유니코드를 올바르게 처리한다.
        환경마다 바뀌지 않는 고정 속성이므로 하드코딩한다.
    """
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        charset="utf8mb4",
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )
