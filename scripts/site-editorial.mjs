const rulesByPath = new Map([
  ["1-2_ERD와 표기법 - 작성 순서 Chen IE Barker UML 대응.md", [
    ["부서 DB팀에 홍길동이 소속한다.", "부서 DB팀에 홍길동이 소속된다."]
  ]],
  ["1-3_엔터티 - 유무형 발생시점 분류와 명명 규칙.md", [
    ["relationship으로 할까 entity로 할까", "관계로 모델링할지 독립된 엔터티로 모델링할지"],
    ["1개의 속성은 **1개의 속성값**을 가진다.", "한 인스턴스에서 하나의 속성은 **하나의 속성값**을 가진다."]
  ]],
  ["1-4_속성 - 기본 설계 파생 속성과 PK FK 일반 속성.md", [
    ["**엔터티 구성방식**(관계 참여 여부)", "**엔터티 내 역할**(식별·관계 참여)"],
    ["## 2. 엔터티 구성방식(분해 여부)에 따른 분류", "## 2. 엔터티 내 역할에 따른 분류"],
    ["기본키가 변경되면 속성도 변경된다.", "함수 종속은 같은 기본키 값이 같은 종속 속성값을 결정한다는 뜻이다. 기본키 값이 바뀔 때 다른 속성값도 반드시 바뀐다는 뜻은 아니다."]
  ]],
  ["1-5_관계 - 존재관계 행위관계와 UML 연관 의존관계.md", [
    ["사원 '홍길동'이 소속한다.", "사원 '홍길동'이 소속된다."],
    ["관계명(Membership)", "관계명(Relationship Name)"],
    ["각각의 INSERT 문으로 개발하면 안 되고", "두 잔액 변경을 서로 다른 트랜잭션으로 처리하면 안 되고"],
    ["트랜잭션에 의한 관계는 필수적인 관계 형태를 가진다.", "같은 업무 트랜잭션에서 반드시 함께 생성·변경되는 엔터티 사이에는 필수 관계가 나타날 수 있다."],
    ["즉 두 잔액 변경을 서로 다른 트랜잭션으로 처리하면 안 되고, 부분 COMMIT도 불가하며 동시 COMMIT이나 ROLLBACK으로 처리해야 한다.", "두 잔액 변경을 하나의 트랜잭션으로 묶어 함께 COMMIT하거나, 오류가 나면 모두 ROLLBACK해야 한다."]
  ]],
  ["1-6_식별자 - 주식별자 분류와 식별 비식별 관계.md", [
    ["하나의 엔터티는 반드시 하나의 유일한 식별자가 존재한다.", "하나의 엔터티에는 인스턴스를 구분할 수 있는 식별자가 하나 이상 존재해야 하며, 후보 식별자 중 하나를 주식별자로 선택한다."],
    ["NULL 값 단 1개만 가능", "NULL 허용 방식은 DBMS마다 다름. PostgreSQL의 기본 UNIQUE 제약은 여러 NULL을 허용"],
    ["SQL 문의 조인 관계를 최소화해야 하는 경우에 사용한다.", "부모 키를 자식의 주식별자에 포함해 식별 관계를 명확히 해야 할 때 사용한다."],
    ["부모 엔터티 없이 자식 엔터티가 생성이 가능한 경우다.", "부모의 키가 자식 주식별자에 포함되지 않는 관계다. 부모가 반드시 필요한지는 FK의 NULL 허용 여부와 업무 규칙으로 별도 결정한다."],
    ["자식 주식별자 구성에 부모 주식별자 부분 필요", "자식 주식별자 구성에 부모 주식별자 포함 불필요"],
    ["부모쪽의 관계참여가 선택관계", "부모 참여의 필수·선택 여부와는 별도"],
    ["비식별관계에서 조인이 많이 발생한다.", "식별·비식별 관계의 선택만으로 조인 횟수가 결정되지는 않는다."],
    ["식별자 관계는 부모 키가 자식 PK에 이미 들어 있어 상위 계층까지 한 번에 접근할 수 있지만, 비식별관계는 매번 조인해서 부모를 찾아가야 하기 때문이다.", "조인 횟수와 성능은 조회 경로, 정규화 수준, 인덱스와 쿼리 설계에 따라 달라진다."]
  ]],
  ["1-7_정규화 - 함수 종속성과 1NF부터 5NF 반정규화.md", [
    ["PK가 아닌 애가 속성을 결정", "기본키가 아닌 일반 속성이 다른 속성을 결정"],
    ["자기들끼리 독립해서 다른 테이블을 만들면 되지만", "서로 독립적인 관계로 분리하되"],
    ["분해: [학생번호(PK), 지도교수] + [과목명(PK), 지도교수]", "분해: [학생번호(PK), 지도교수(PK)] + [지도교수(PK), 과목명]"],
    ["4NF를 만족해야 하며 조인 종속(Join Dependency)이 없어야 한다.", "4NF를 만족하며 후보 키로부터 유도되지 않는 비자명한 조인 종속(Join Dependency)이 없어야 한다."],
    ["조인 연산을 했을 시 손실이 없어야 한다.", "더 작은 릴레이션으로 분해한 뒤 자연 조인했을 때 원래 릴레이션을 손실 없이 복원할 수 있어야 한다."],
    ["| 데이터의 중복 감소 → 용량 최소화 | 향상 |", "| 데이터 중복과 저장 낭비 | 대체로 감소 |"],
    ["| 데이터가 관심사별로 묶임 | 향상 |", "| 데이터 일관성과 변경 용이성 | 대체로 향상 |"],
    ["| 데이터 입력 / 수정 / 삭제 | 향상 |", "| 입력·수정·삭제 이상 | 대체로 감소 |"],
    ["| 조회(SELECT) 질의에서 JOIN이 많이 발생 | 저하 (조회의 경우 처리조건에 따라 향상될 수도 있음) |", "| 조회 시 JOIN 수 | 늘 수 있으나 성능은 실행 계획과 인덱스에 따라 달라짐 |"],
    ["조회 속도를 향상시키나, 데이터 모델의 유연성은 낮아진다. 즉 입력/수정/삭제 성능이 저하된다.", "조회 성능 개선을 목적으로 하지만 효과는 실행 계획과 사용 패턴에 따라 달라진다. 데이터 중복 때문에 유연성이 낮아지고 입력·수정·삭제의 유지 비용이 커질 수 있다."]
  ]],
  ["1-8_모델과 SQL - 조인 트랜잭션 NULL 본질식별자 인조식별자.md", [
    ["조인이 왜 생기는지, 필수 관계가 왜 트랜잭션인지, NULL이 왜 연산에서 사라지는지가 핵심이다.", "조인의 원리, 트랜잭션의 원자성, NULL의 연산 규칙을 SQL과 연결해 이해하는 것이 핵심이다."],
    ["조인이란 식별자를 상속하고, 상속된 속성을 매핑키로 활용하여 데이터를 결합하는 것이다.", "조인은 둘 이상의 테이블에서 논리적으로 관련된 행을 조건에 따라 결합하는 연산이다. PK와 FK가 대표적인 조인 키지만 다른 조건으로도 조인할 수 있다."],
    ["부모의 식별자를 자식의 식별자에 포함하면 식별관계, 자식의 일반속성으로 상속하면 비식별관계이며, 비식별관계에서 조인이 많이 발생한다.", "부모의 식별자를 자식 주식별자에 포함하면 식별 관계이고, 일반 속성으로 두면 비식별 관계다. 관계 유형만으로 조인 횟수나 성능이 결정되지는 않는다."],
    ["WHERE a.직원ID = b.상사ID;", "WHERE a.상사ID = b.직원ID;"],
    ["각각의 INSERT 문으로 개발해서는 안 되고", "두 UPDATE를 서로 다른 트랜잭션으로 처리해서는 안 되고"],
    ["트랜잭션에 의한 관계는 필수적인 관계 형태를 가진다.", "같은 업무 트랜잭션에서 반드시 함께 생성·변경되는 엔터티 사이에는 필수 관계가 나타날 수 있다."],
    ["2번과 3번 과정은 동시에 수행되어야 한다.", "2번과 3번 과정은 하나의 트랜잭션으로 묶여 원자적으로 처리되어야 한다."],
    ["두 UPDATE를 서로 다른 트랜잭션으로 처리해서는 안 되고, 부분 COMMIT은 불가하며 동시 COMMIT이나 ROLLBACK으로 처리해야 한다.", "두 UPDATE를 하나의 트랜잭션으로 묶어 함께 COMMIT하거나, 오류가 나면 모두 ROLLBACK해야 한다."],
    ["널 값을 포함하는 연산의 경우 결과값도 널 값이다.", "NULL을 포함한 일반적인 산술 연산의 결과는 NULL이다."],
    ["unknown OR FALSE", "UNKNOWN"],
    ["결괏값을 NULL이 아닌 다른 값으로 얻고자 할 때 NVL/ISNULL 함수를 사용한다.", "결괏값의 NULL을 다른 값으로 바꿀 때 표준 SQL과 PostgreSQL에서는 COALESCE를 사용한다. Oracle의 NVL, SQL Server의 ISNULL도 같은 목적으로 사용한다."],
    ["NVL(C, 0)   -- 컬럼 C에 NULL값은 0으로 치환하라", "COALESCE(C, 0)   -- 컬럼 C가 NULL이면 0을 반환"],
    ["원조(본질) 식별자", "본질 식별자"],
    ["원조 식별자가 PK 2개 이상인 복합 식별자일 때 속성들을 하나의 속성으로 묶어서 사용하면 그것이 인조 식별자다.", "업무 식별자가 여러 컬럼으로 구성되어 지나치게 복잡할 때 별도의 단일 대리 키를 추가할 수 있다. 기존 업무 키에는 UNIQUE 제약을 유지해 중복을 막는다."],
    ["불필요한 인덱스 생성 → 저장 공간 낭비 및 DML 성능 저하 (PK 생성 시 unique 인덱스가 자동 생성됨)", "대리 키 인덱스와 업무 키 UNIQUE 인덱스를 함께 관리할 때 저장 공간과 DML 비용이 늘 수 있음"],
    ["별도의 인덱스 생성이 필요", "업무 키 검색을 위한 별도 인덱스가 필요할 수 있음"]
  ]],
  ["2-1_관계형 데이터베이스와 무결성 - 키 4대 제약 SQL 실행 단계.md", [
    ["DML: 사용자가 COMMIT 해야 함 → ROLLBACK 가능", "DML: 트랜잭션 모드에 따라 COMMIT·ROLLBACK으로 제어 가능. 자동 커밋 여부는 DBMS와 클라이언트 설정에 따라 다름"],
    ["DDL: AUTO COMMIT → ROLLBACK 불가능", "DDL: Oracle은 암시적 COMMIT을 수반함. PostgreSQL은 대부분의 DDL을 명시적 트랜잭션 안에서 ROLLBACK 가능"],
    ["TRUNCATE는 데이터 삭제지만 오토커밋 특성 때문에 DDL에 포함된다.", "TRUNCATE는 행 단위 DML이 아니라 테이블 전체를 대상으로 하는 DDL이다. 커밋·롤백 가능 여부는 DBMS마다 다르다."]
  ]],
  ["2-2_SELECT 문 - 절 구성과 논리적 실행 순서 ALIAS DISTINCT.md", [
    ["(GROUP BY와 HAVING의 순서는 서로 바꿀 수 있으나 보통 사용 X)", "(GROUP BY를 쓴다면 HAVING은 그 뒤에 작성한다)"],
    ["SELECT에서 만든 별칭(ALIAS)은 ORDER BY에서만 쓸 수 있다. WHERE·GROUP BY·HAVING은 SELECT보다 먼저 실행되므로 별칭이 아직 없다.", "SELECT 목록에서 만든 별칭의 사용 가능 위치는 DBMS마다 다르다. ORDER BY에서는 널리 지원되며 PostgreSQL은 GROUP BY에서도 허용한다. WHERE와 HAVING에서는 일반적으로 사용할 수 없다."],
    ["SELECT 문보다 늦게 사용되는 ORDER BY 절에서만 컬럼 별칭 사용 가능 (HAVING이나 WHERE 절에서 사용 시 에러 발생)", "컬럼 별칭은 ORDER BY에서 널리 사용할 수 있다. PostgreSQL은 GROUP BY에서도 허용하며, WHERE와 HAVING에서는 일반적으로 사용할 수 없다"],
    ["(역따옴표도 사용 가능)", "(MySQL에서는 역따옴표도 사용할 수 있다)"],
    ["ORACLE은 문자 상수의 경우 대소문자를 구분한다.", "문자 비교의 대소문자 구분은 DBMS와 콜레이션 설정에 따라 달라진다. Oracle의 기본 이진 비교는 대소문자를 구분한다."],
    ["MSSQL은 기본적으로 문자 상수의 대소문자를 구분 X", "SQL Server는 데이터베이스나 컬럼의 콜레이션 설정을 따른다."],
    ["MySQL은 비교나 검색을 수행할 때 기본적으로 대소문자 구분 없이 비교 및 검색이 가능하다.", "MySQL도 컬럼의 콜레이션 설정에 따라 대소문자 구분 여부가 달라진다."]
  ]],
  ["2-3_함수 - 단일행 다중행 NULL 함수와 CASE DECODE.md", [
    ["2024/11/31", "2024/11/30"],
    ["DATEADD(unit, d, n)", "DATEADD(unit, n, d)"],
    ["FORMAT(GETDATE(),'YYYY')", "FORMAT(GETDATE(),'yyyy')"]
  ]],
  ["2-4_WHERE GROUP BY HAVING ORDER BY - 조건 그룹 정렬.md", [
    ["별칭(ALIAS) 사용 불가능.", "별칭 사용 가능 여부는 DBMS마다 다르다. PostgreSQL은 GROUP BY에서 SELECT 출력 별칭을 허용한다."],
    ["컬럼 별칭은 SELECT 절에서 정의되어 SELECT 구문이 실행될 때 만들어지는 이름이라, SELECT 이전에 실행되는 GROUP BY나 WHERE 절에서는 사용이 불가능하다.", "SELECT 출력 별칭은 WHERE에서는 사용할 수 없다. GROUP BY에서 사용할 수 있는지는 DBMS마다 다르며 PostgreSQL은 허용한다."],
    ["HAVING 절이 GROUP BY 절 앞에 위치해도 되나, 논리적 실행 순서에 맞게 GROUP BY 뒤에 쓰는 것을 권장한다.", "GROUP BY를 사용하는 문장에서는 HAVING을 GROUP BY 뒤에 작성한다. GROUP BY 없이 HAVING만 쓰면 전체 결과를 하나의 그룹으로 취급한다."],
    ["HAVING 절이 SELECT 절보다 먼저 수행되니 SELECT절에서 선언된 ALIAS 사용 불가", "HAVING에서는 SELECT 출력 별칭을 일반적으로 사용할 수 없다. 일부 DBMS의 확장 문법은 예외다"],
    ["ALIAS 명을 사용할 수 없다.", "HAVING에서는 SELECT 출력 별칭을 일반적으로 사용할 수 없고, GROUP BY는 DBMS별 차이가 있다."],
    ["IN은 NULL값을 무시한다.", "IN 목록의 NULL은 참인 일치 결과를 만들지 않는다."],
    ["`NOT IN`은 IN의 반대 연산자로, 목록에 없는 값을 필터링한다.", "`NOT IN` 목록에 NULL이 있으면 비교 결과가 UNKNOWN이 되어 행이 반환되지 않을 수 있으므로 주의한다."],
    ["(반드시 A < B)", "(A와 B가 같아도 한 값의 범위로 유효하며, A가 B보다 크면 일치하는 값이 없다)"],
    ["LIKE 연산자는 대소문자를 구분한다.", "LIKE의 대소문자 구분은 DBMS와 콜레이션 설정에 따라 달라진다. PostgreSQL의 LIKE는 기본적으로 구분하며 ILIKE는 구분하지 않는다."],
    ["NULL값과의 비교연산은 거짓을 리턴한다.", "NULL 값과의 비교 연산은 UNKNOWN을 반환한다."],
    ["WHERE 절의 조건이 FALSE가 되어", "WHERE 절에서 TRUE가 아니므로"]
  ]],
  ["2-5_조인 - EQUI NON EQUI INNER OUTER NATURAL CROSS SELF.md", [
    ["FROM 절에 여러 테이블이 나열되더라도 SQL에서 데이터를 처리할 때는 단 2개의 집합 간에만 조인이 일어난다. FROM A, B, C라면 A JOIN B가 먼저 실행되고 그 결과 집합과 C의 조인이 일어난다.", "여러 테이블의 조인은 논리적으로 결합되지만 실제 조인 순서와 방식은 옵티마이저가 통계와 비용을 바탕으로 바꿀 수 있다."],
    ["옵티마이저는 FROM절에 나열된 데이터들을 항상 2개로 묶어서 처리한다.", ""],
    ["ANSI 표준에서 ON은 조인 조건, WHERE는 일반 조건을 명시한다.", "ANSI 조인에서 ON은 행의 일치 조건을, WHERE는 조인 결과의 필터 조건을 명시한다. OUTER JOIN에서는 조건을 ON과 WHERE 중 어디에 두는지에 따라 결과가 달라질 수 있다."],
    ["오라클 표준에서는 FULL OUTER JOIN을 직접적으로 지원하지 않으나, UNION을 통해 구현이 가능하다.", "Oracle은 ANSI FULL OUTER JOIN을 직접 지원한다. 구형 Oracle 전용 외부 조인 연산자 (+)만으로는 FULL OUTER JOIN을 표현할 수 없어 집합 연산으로 우회하기도 한다."],
    ["FULL OUTER JOIN = LEFT OUTER JOIN의 결과 UNION RIGHT OUTER JOIN의 결과 (UNION은 중복 데이터를 하나만 반환)", "집합 연산으로 흉내 낼 때는 LEFT JOIN 결과에 오른쪽의 미일치 행만 UNION ALL로 더해야 한다. 단순 LEFT JOIN UNION RIGHT JOIN은 중복 의미가 달라질 수 있다."]
  ]],
  ["2-6_서브쿼리 - 스칼라 인라인뷰 중첩 연관 서브쿼리.md", [
    ["서브쿼리엔 ORDER BY 사용 불가 (ORDER BY 절에서 서브쿼리를 사용하는 것은 가능)", "서브쿼리의 ORDER BY 허용 범위는 DBMS마다 다르다. PostgreSQL에서는 LIMIT·FETCH와 함께 정렬된 일부 행을 만들거나, 배열·문자열 집계처럼 순서가 의미 있는 경우 사용할 수 있다. 최종 결과의 표시 순서는 가장 바깥 SELECT의 ORDER BY로 보장한다."],
    ["ORDER BY 절은 SELECT 절에서 오직 한 개만 올 수 있다.", ""],
    ["ORDER BY는 메인쿼리의 마지막 문장에 위치해야 한다.", ""],
    ["예외: TOP-N 분석", ""],
    ["'단일행 연관 서브쿼리' 이며, 메인쿼리의 각 행마다 하나의 단일값을 반환해준다.", "연관 또는 비연관 형태로 작성할 수 있으며, 결과는 한 행·한 컬럼이어야 한다."],
    ["스칼라 서브쿼리는 OUTER JOIN 연산을 사용한 결과와 같다.", "일부 스칼라 서브쿼리는 LEFT JOIN으로 바꿀 수 있지만 중복 행과 집계 방식에 따라 결과가 달라질 수 있다."],
    ["메인쿼리의 행마다 독립적으로 실행", "논리적으로 메인 쿼리의 각 행과 결합될 수 있으며 실제 실행 방식은 옵티마이저가 결정"],
    ["한 번 만들어져 테이블처럼 조인됨", "테이블 형태로 사용되며 실제 물리화·병합 여부는 옵티마이저가 결정"],
    ["두 테이블 사이에 명확한 JOIN 조건이 존재하지 않아 Cartesian Product 생성", "콤마 조인은 논리적으로 카티션 곱에 WHERE 필터를 적용한 형태이며, 실제 실행 계획은 옵티마이저가 변환할 수 있음"],
    ["다중컬럼 서브쿼리 (SQL Server 지원 X)", "다중 컬럼 서브쿼리 (이 형태는 SQL Server 미지원, PostgreSQL 지원)"]
  ]],
  ["2-7_집합 연산자와 그룹 함수 - UNION ROLLUP CUBE GROUPING SETS.md", [
    ["EXCEPT (ORACLE: MINUS) | 차집합. 중복 제거. 두 집합 중 한 쪽 집합에만 존재하는 행 출력", "EXCEPT (Oracle: MINUS) | 차집합. 첫 번째 결과에는 있고 두 번째 결과에는 없는 행을 반환하며 중복은 제거"],
    ["UNION은 중복된 데이터를 제거하기 위해 내부적으로 정렬을 수행한다.", "UNION은 중복을 제거하기 위한 추가 연산을 수행하며, DBMS는 정렬이나 해시 방식을 선택할 수 있다."],
    ["NVL 대신 GROUPING 함수를 이용해서 NULL값을 다른 값으로 대체할 수 있다.", "GROUPING 함수는 해당 NULL이 소계·총계 행에서 생성된 값인지 판별한다. CASE나 DECODE와 함께 사용해 표시 문구로 바꿀 수 있다."]
  ]],
  ["2-8_윈도우 함수 - 순위 집계 행 순서 비율과 ROWS RANGE.md", [
    ["| **ROWS \\| RANGE BETWEEN A AND B 절** | 연산 범위 설정. **ORDER BY 절 필수**. SQL Server 지원 X |", "| **ROWS \\| RANGE BETWEEN A AND B 절** | 연산 범위 설정. 프레임 의미를 정하려면 ORDER BY가 필요하며 SQL Server도 지원 |"],
    ["MIN(), MAX() | ORDER BY 영향 X", "MIN(), MAX() | ORDER BY와 프레임을 지정하면 누적 최솟값·최댓값처럼 결과가 달라짐"],
    ["ROWS BETWEEN UNBOUNDED PRECEDING AND 1 FOLLOWING | 첫 행부터 그 다음 행까지 연산", "ROWS BETWEEN UNBOUNDED PRECEDING AND 1 FOLLOWING | 파티션의 첫 행부터 현재 행의 다음 한 행까지 연산"],
    ["LAG와 LEAD (SQL Server 지원 X)", "LAG와 LEAD (SQL Server 지원)"],
    ["FIRST_VALUE, LAST_VALUE (SQL Server 지원 X)", "FIRST_VALUE, LAST_VALUE (SQL Server 지원)"],
    ["PARTITION BY, ORDER BY 절 생략 가능", "PARTITION BY는 선택 사항이다. 결과의 순서를 정하려면 ORDER BY를 명시해야 하며 SQL Server에서는 필수다"],
    ["NTILE(N) (SQL Server 지원 X)", "NTILE(N) (SQL Server 지원)"],
    ["비율 관련 함수 (SQL Server 지원 X) ★", "비율 관련 함수 ★ — PERCENT_RANK와 CUME_DIST는 SQL Server도 지원하며 RATIO_TO_REPORT는 지원하지 않는다"],
    ["즉 PERCENTILE(분위수) 를 출력한다.", "즉 파티션 안에서 현재 순위의 상대적 위치를 0부터 1 사이 값으로 나타낸다."],
    ["PERCENT_RANK | 행 순서별 백분율, 건수", "PERCENT_RANK | 순위의 상대적 위치"]
  ]],
  ["2-9_TOP N 계층형 질의 PIVOT 정규 표현식.md", [
    ["출력된 데이터를 기준으로 행 번호가 부여된다.", "Oracle의 ROWNUM은 행이 결과 후보로 선택되는 순서에 따라 부여되는 의사 컬럼이다. 정렬 결과의 상위 N개를 구하려면 먼저 서브쿼리에서 정렬한 뒤 바깥 쿼리에서 ROWNUM을 적용한다. 영구적인 행 식별자로 사용할 수는 없다."],
    ["따라서 ORDER BY나 WHERE절로 데이터를 제한할 경우, 또다른 순서가 그 때 그때 부여된다.", ""],
    ["절대적인 행 번호가 아닌 가상의 번호라 특정 행을 지정할 수 없다.", ""],
    ["첫번째 행이 증가한 이후 할당되므로 > 연산 사용 불가", "같은 쿼리 단계에서 ROWNUM > 1 조건은 첫 행을 확정하지 못하므로 결과가 없다"],
    ["WHERE절에서 ROWNUM에 대한 조건을 걸 때 ROWNUM = 1 값이 무조건 포함이 되어야만 한다.", "같은 쿼리 단계에서 ROWNUM으로 범위를 제한할 때는 1부터 시작하는 상한 조건을 사용한다. 시작 위치가 2 이상인 범위는 인라인 뷰에서 번호를 먼저 만든 뒤 바깥에서 필터링한다."],
    ["PRIOR 자식 = 부모", "PRIOR 부모키 = 자식의 부모키"],
    ["자식 → 부모 데이터로 순방향 전개", "부모 → 자식 방향으로 전개"],
    ["PRIOR 부모 = 자식", "PRIOR 자식의 부모키 = 부모키"],
    ["부모 → 자식 데이터로 역방향 전개", "자식 → 부모 방향으로 전개"],
    ["루프노드(최상위 계층)", "루트 노드(최상위 계층)"],
    ["다른 테이블과의 조인 연산 불가능", "다른 테이블과 조인할 수 있지만 열이 계속 늘어나는 구조라 분석·확장에 불리할 수 있음"],
    ["{,m} | 최대 m회 일치", "{0,m} | 최대 m회 일치" ]
  ]],
  ["2-10_관리 구문 - DML TCL DDL 제약조건 DCL.md", [
    ["DML은 사용자가 COMMIT해야 반영되고 DDL은 AUTO COMMIT이라 롤백이 불가하다. 이 하나의 차이에서 시험 문제 여러 개가 파생된다.", "DML과 DDL의 COMMIT·ROLLBACK 동작은 DBMS와 트랜잭션 설정에 따라 다르다. Oracle의 DDL은 암시적 COMMIT을 수반하지만 PostgreSQL은 대부분의 DDL을 명시적 트랜잭션 안에서 ROLLBACK할 수 있다."],
    ["**DDL**: 직접 DB에 영향을 미쳐 명령어를 입력하는 순간 해당 작업이 **즉시(AUTO COMMIT) 완료**된다.", "**DDL**: 데이터 구조를 정의·변경한다. Oracle에서는 암시적 COMMIT이 발생하지만 PostgreSQL에서는 대부분 명시적 트랜잭션으로 제어할 수 있다."],
    ["**DML**: 조작하려는 테이블을 **메모리 버퍼에 올려놓고** 작업을 해서 실시간으로 테이블에 영향을 미치는 것이 아니다. 따라서 버퍼에서 처리한 DML 명령어가 실제 테이블에 반영되기 위해선 **COMMIT 명령어를 입력해 TRANSACTION을 종료**해야 한다.", "**DML**: 데이터를 조회·입력·수정·삭제한다. 변경 결과의 확정·취소 방식은 자동 커밋 여부와 명시적 트랜잭션 사용 여부에 따라 달라진다."],
    ["**SQL Server: DML도 AUTO COMMIT으로 처리**된다.", "**SQL Server**는 기본적으로 각 문장을 자동 커밋하지만 명시적 트랜잭션도 지원한다."],
    ["**COMMIT, ROLLBACK 필수**", "명시적 트랜잭션에서는 **COMMIT 또는 ROLLBACK으로 종료**"],
    ["**ORACLE: 한 번에 한 행만 입력 가능 / SQL Server: 여러 행 동시 삽입 가능**", "여러 행 입력 문법은 DBMS와 버전에 따라 다르다. SQL Server와 PostgreSQL은 다중 VALUES를 지원하며, Oracle은 버전에 따라 INSERT ALL 등의 문법을 사용한다."],
    ["**SQL Server에서 `''` 데이터를 삽입하면 아무것도 입력 X**(NULL 입력 아님)", "**SQL Server에서 `''`를 삽입하면 빈 문자열로 저장**된다(NULL 아님)"],
    ["AUTO COMMIT 이라 ROLLBACK 불가", "Oracle 기준으로 암시적 COMMIT이 발생함. PostgreSQL 등은 동작이 다름"],
    ["ORACLE: **DDL 시 AUTO COMMIT** (23c 버전부터 비활성화 가능)", "Oracle: **DDL 실행 전과 성공 후 암시적 COMMIT 발생**"],
    ["불가능 (Auto Commit)", "DBMS와 트랜잭션 설정에 따라 다름"],
    ["DROP TABLE 테이블명 [CASCADE CONSTRAINT];", "DROP TABLE 테이블명 [CASCADE CONSTRAINTS];"],
    ["CASCADE CONSTRAINT 옵션", "CASCADE CONSTRAINTS 옵션"],
    ["PK나 FK는 default값을 가지지 않는다. PK는 고유성에 위배되며, FK의 경우 기본값이 참조 테이블에 존재하지 않는 경우 무결성 제약 조건을 위반할 위험이 있다.", "PK와 FK 컬럼에도 기본값을 지정할 수 있다. PK의 기본값은 행마다 고유해야 하고, FK의 기본값은 부모 테이블에 존재하거나 NULL 허용 조건을 만족해야 한다."],
    ["Restrict | Parent 삭제 시 Child 테이블에 PK가 없는 경우에만 Parent 삭제 허용", "Restrict | 부모 행을 참조하는 자식 행이 있으면 부모의 삭제·키 변경을 거부"],
    ["기본 테이블이 삭제되면 그 테이블을 참조하여 만든 뷰 역시 삭제된다.", "기본 테이블 삭제 시 뷰 처리 방식은 DBMS와 CASCADE·RESTRICT 옵션에 따라 달라진다."],
    ["뷰의 정의 변경 불가", "뷰 정의 변경 방식은 DBMS마다 다름"],
    ["인덱스 구성 불가", "일반 뷰의 인덱스 지원 여부는 DBMS마다 다름. 물리화 뷰·인덱스드 뷰는 별도 기능"],
    ["PRIVATE으로 할 경우 시노님을 생성한 유저만 사용 가능", "PUBLIC을 생략하면 private synonym이 되어 생성한 사용자 범위에서 사용"],
    ["롤은 다양한 권한의 묶음으로 **SYSTEM 계정에서 생성 가능**하다.", "롤은 다양한 권한의 묶음이며, Oracle에서는 `CREATE ROLE` 시스템 권한이 있는 사용자가 생성할 수 있다."],
    ["※ TRUNCATE이 데이터 삭제라 DML에 껴야 할 것 같지만 AUTO COMMIT 특성 때문에 DDL에 포함된다.", "※ TRUNCATE는 행 단위 DML이 아니라 테이블 전체를 대상으로 하는 DDL이다. COMMIT·ROLLBACK 동작은 DBMS마다 다르다."]
  ]],
  ["헷갈리는 개념 구분표 - ERD UML 관계 속성 정규화.md", [
    ["| 부모 없이 자식 생성 | 불가 | 가능 |", "| 부모 존재 필요 여부 | FK의 NULL 허용 여부와 업무 규칙으로 결정 | FK의 NULL 허용 여부와 업무 규칙으로 결정 |"],
    ["| 조인 | 조인 최소화에 유리 | 조인이 많이 발생 |", "| 조인 | 관계 유형만으로 횟수·성능을 단정할 수 없음 | 관계 유형만으로 횟수·성능을 단정할 수 없음 |"],
    ["값을 조회할 때야 편하지만", "조회에는 편리하지만"],
    ["조인 시 손실이 없어야 함", "후보 키에서 유도되지 않는 비자명한 조인 종속이 없어야 하며, 분해 후 자연 조인으로 원래 관계를 손실 없이 복원해야 함"],
    ["| 데이터 중복 감소 → 용량 최소화 | 향상 |", "| 데이터 중복과 저장 낭비 | 대체로 감소 |"],
    ["| 데이터가 관심사별로 묶임 | 향상 |", "| 데이터 일관성과 변경 용이성 | 대체로 향상 |"],
    ["| 입력 / 수정 / 삭제 | 향상 |", "| 입력·수정·삭제 이상 | 대체로 감소 |"],
    ["| 조회(SELECT)에서 JOIN이 많이 발생 | 저하 |", "| 조회 시 JOIN 수 | 늘 수 있으나 성능은 실행 계획과 인덱스에 따라 달라짐 |"],
    ["반정규화는 이 방향을 뒤집는다: 조회 속도 향상 ↔ 유연성 하락, 입력/수정/삭제 성능 저하.", "반정규화는 조회 성능 개선을 목적으로 중복을 허용하지만, 실제 효과는 실행 계획과 사용 패턴에 따라 달라지고 변경 비용이 커질 수 있다."],
    ["자기들끼리 독립해서 다른 테이블을 만들면 되지만", "서로 독립적인 관계로 분리하되"],
    ["인조식별자를 사용하면 중복 데이터를 막기 어려워진다 | 참", "인조식별자만 두고 업무 키의 UNIQUE 제약을 생략하면 중복 데이터가 생길 수 있다 | 참"],
    ["비식별관계에서 조인이 많이 발생한다 | 참", "비식별 관계라는 이유만으로 조인이 많아진다 | 거짓 — 조회 경로와 모델 구조에 따라 다름"],
    ["SELECT에서 만든 별칭은 WHERE 절에서 쓸 수 있다 | 거짓 — ORDER BY에서만 가능", "SELECT에서 만든 별칭은 WHERE 절에서 쓸 수 있다 | 거짓 — WHERE에서는 사용할 수 없고 다른 절은 DBMS별 차이가 있음"]
  ]],
  ["3-실습/3-1_실습 환경 구축 - PostgreSQL Docker Compose.md", [
    ["`psql -f`는 SQL 파일을 읽어 실행하고, `ON_ERROR_STOP=1`은 오류 발생 시 이후 명령을 계속 실행하지 않게 한다.", "위 명령은 셸의 표준 입력 리다이렉션(`< answer.sql`)으로 SQL 파일을 `psql`에 전달한다. `ON_ERROR_STOP=1`은 오류가 발생하면 이후 명령을 계속 실행하지 않게 한다."],
    ["| `FULL OUTER JOIN` | `LEFT JOIN ... UNION ... RIGHT JOIN` |", "| `FULL OUTER JOIN` | `LEFT JOIN ... UNION ALL ... RIGHT JOIN ... WHERE 왼쪽키 IS NULL`처럼 오른쪽 미일치 행만 추가 |"],
    ["`WITH RECURSIVE`, 윈도우 함수, `GROUPING SETS` 등은 사용하는 MySQL 버전과 세부 기능 지원 여부를 확인한다.", "MySQL 8 이상은 `WITH RECURSIVE`와 주요 윈도우 함수를 지원한다. `GROUPING SETS`는 지원하지 않으므로 `UNION ALL`이나 `WITH ROLLUP`으로 목적에 맞게 바꾼다."]
  ]],
  ["3-실습/3-3_실습 문제 - 조회 조건 함수 정렬.md", [
    ["[[3-2_실습 데이터셋 - 쇼핑몰 스키마|데이터셋]]을 사용한다. 모든 문제는 별도 지시가 없으면 다음 문장부터 실행한다.", "[[3-2_실습 데이터셋 - 쇼핑몰 스키마|실습 데이터셋]]을 사용한다. 별도 지시가 없으면 각 문제를 풀기 전에 다음 문장을 먼저 실행한다."],
    ["2024년 기준 나이를 출력하라.", "2024년 연 나이(`2024 - 출생연도`)를 출력하라."]
  ]],
  ["3-실습/3-4_실습 문제 - 조인 그룹 서브쿼리 집합.md", [
    ["[[3-2_실습 데이터셋 - 쇼핑몰 스키마|데이터셋]]을 사용한다.", "[[3-2_실습 데이터셋 - 쇼핑몰 스키마|실습 데이터셋]]을 사용한다."],
    ["주문번호 1001의 상세부터 확인한다.", "주문번호 1001의 상세만 조회하고 행 번호 오름차순으로 정렬한다."],
    ["취소되지 않은 주문을 기준으로", "주문상태가 `CANCELLED`가 아닌 주문(`REFUNDED` 포함)을 기준으로"],
    ["리뷰를 작성했지만 주문은 하지 않은 고객", "리뷰를 작성했지만 주문은 하지 않은 고객(기본 데이터에서 1명 반환)"]
  ]],
  ["3-실습/3-5_실습 문제 - 윈도우 계층형 DML.md", [
    ["[[3-2_실습 데이터셋 - 쇼핑몰 스키마|데이터셋]]을 사용한다.", "[[3-2_실습 데이터셋 - 쇼핑몰 스키마|실습 데이터셋]]을 사용한다."],
    ["단가가 같은 행이 어떻게 다르게 처리되는지 확인한다.", "`ROWS`는 `unit_price, order_id, line_no` 순서로, `RANGE`는 `unit_price`만으로 정렬해 단가가 같은 행이 어떻게 다르게 처리되는지 확인한다."]
  ]]
]);

export function applySiteEditorialEdits(relativePath, markdown) {
  let result = applyStructuralEdits(relativePath, markdown);
  for (const [from, to] of rulesByPath.get(relativePath) ?? []) {
    result = replaceRequired(result, from, to, relativePath);
  }
  result = transformProse(result, normalizeEditorialStyle);
  result = protectNumericRanges(result);
  result = protectInlineCodePipes(result);
  return result;
}

export function applySiteAssetEdits(relativePath, source) {
  if (relativePath !== "3-실습/db/02_seed.sql") return source;
  return replaceRequired(
    source,
    "    (15, 11, 203, 4, DATE '2024-07-25', '사용하기 편합니다.');",
    "    (15, 11, 203, 4, DATE '2024-07-25', '사용하기 편합니다.'),\n    (16, 12, 304, 4, DATE '2024-07-28', '모델링 정리에 도움이 됩니다.');",
    relativePath
  ).replace("ALTER TABLE reviews ALTER COLUMN review_id RESTART WITH 16;", "ALTER TABLE reviews ALTER COLUMN review_id RESTART WITH 17;");
}

function applyStructuralEdits(relativePath, markdown) {
  if (relativePath !== "2-7_집합 연산자와 그룹 함수 - UNION ROLLUP CUBE GROUPING SETS.md") return markdown;
  const pattern = /### 테이블 관계에 따른 성질[\s\S]*?(?=\n## 집계 함수 복습)/;
  if (!pattern.test(markdown)) throw new Error(`사이트 교정 대상을 찾지 못했습니다: ${relativePath} / 테이블 관계에 따른 성질`);
  return markdown.replace(pattern, `### 관계와 집합 연산 결과

테이블의 1:1·1:N 관계만으로 UNION·INTERSECT·EXCEPT·JOIN의 행 수를 단정할 수 없다. 집합 연산은 선택한 컬럼의 실제 값과 중복 여부로 결과가 정해지고, JOIN은 조인 조건과 각 키의 중복 여부로 결과가 정해진다.
`);
}

function replaceRequired(source, from, to, relativePath) {
  if (source.includes(from)) return source.replaceAll(from, to);

  const plain = [];
  const positions = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source.slice(index, index + 2) === "**") {
      index += 1;
      continue;
    }
    if (source[index] === "`") continue;
    plain.push(source[index]);
    positions.push(index);
  }
  const plainSource = plain.join("");
  const plainIndex = plainSource.indexOf(from);
  if (plainIndex < 0) throw new Error(`사이트 교정 대상을 찾지 못했습니다: ${relativePath} / ${from}`);
  let start = positions[plainIndex];
  let end = positions[plainIndex + from.length - 1] + 1;
  if (source.slice(start - 2, start) === "**") start -= 2;
  if (source.slice(end, end + 2) === "**") end += 2;
  if (source[start - 1] === "`") start -= 1;
  if (source[end] === "`") end += 1;
  return `${source.slice(0, start)}${to}${source.slice(end)}`;
}

function transformProse(markdown, transform) {
  const protectedParts = [];
  const masked = markdown.replace(/```[\s\S]*?```|`[^`\n]*`|!?\[\[[^\]]+\]\]/g, (part) => {
    const token = `\u0000EDITORIAL_${protectedParts.length}\u0000`;
    protectedParts.push(part);
    return token;
  });
  return transform(masked).replace(/\u0000EDITORIAL_(\d+)\u0000/g, (_match, index) => protectedParts[Number(index)]);
}

function normalizeEditorialStyle(source) {
  const replacements = [
    [/NULL값/g, "NULL 값"],
    [/WHERE절/g, "WHERE 절"],
    [/ORDER BY절/g, "ORDER BY 절"],
    [/SELECT절/g, "SELECT 절"],
    [/GROUP BY절/g, "GROUP BY 절"],
    [/HAVING절/g, "HAVING 절"],
    [/FROM절/g, "FROM 절"],
    [/ON절/g, "ON 절"],
    [/데이터타입/g, "데이터 타입"],
    [/데이터양/g, "데이터 양"],
    [/업무처리/g, "업무 처리"],
    [/메인쿼리/g, "메인 쿼리"],
    [/결과값/g, "결괏값"],
    [/칼럼/g, "컬럼"],
    [/ORACLE/g, "Oracle"],
    [/MSSQL/g, "SQL Server"],
    [/unique한/g, "고유한"],
    [/제\s+([1-9])절/g, "제$1절"],
    [/제\s+([1-9])정규형/g, "제$1정규형"],
    [/SQL문/g, "SQL 문"],
    [/제약조건/g, "제약 조건"],
    [/인라인뷰/g, "인라인 뷰"],
    [/제\s+3자/g, "제3자"],
    [/첫번째/g, "첫 번째"],
    [/두번째/g, "두 번째"],
    [/세번째/g, "세 번째"],
    [/그룹핑/g, "그룹화"],
    [/원복/g, "복원"],
    [/각 컬럼들은/g, "각 컬럼은"],
    [/대\/소문자/g, "대소문자"],
    [/(\u0000EDITORIAL_\d+\u0000)\s+(이|가|은|는|을|를|와|과|으로|로|라고|에서|에|의|도|만|이다|이며)(?=[\s.,)])/g, "$1$2"],
    [/\)\s+(이|가|은|는|을|를|와|과|으로|로|라고|에서|에|의|도|만|이다|이며)(?=[\s.,)])/g, ")$1"],
    [/\s+([,.!?])/g, "$1"],
    [/때문 이다/g, "때문이다"],
    [/상태 다/g, "상태다"],
    [/(속성|관계|값|정보|단위) 이며/g, "$1이며"],
    [/가능 하다/g, "가능하다"],
    [/필요 하다/g, "필요하다"],
    [/발생 한다/g, "발생한다"],
    [/수행 한다/g, "수행한다"],
    [/사용 한다/g, "사용한다"],
    [/반환 한다/g, "반환한다"],
    [/출력 한다/g, "출력한다"],
    [/저장 된다/g, "저장된다"],
    [/부여 된다/g, "부여된다"],
    [/생성 된다/g, "생성된다"],
    [/적용 된다/g, "적용된다"],
    [/결정 된다/g, "결정된다"],
    [/종속 된다/g, "종속된다"],
    [/사용 된다/g, "사용된다"],
    [/처리 된다/g, "처리된다"],
    [/표현 된다/g, "표현된다"]
  ];
  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), source);
}

function protectNumericRanges(markdown) {
  return markdown.replace(/(?<=\d)~(?=\d)/g, "\\~");
}

function protectInlineCodePipes(markdown) {
  return markdown.replace(/`([^`\n]*)`/g, (_match, code) => `\`${code.replace(/(?<!\\)\|/g, "\\|")}\``);
}
