# 쿠키앤모어 재고현황 페이지

실시간 품절 현황 공유 페이지 (Next.js + Supabase)

## 페이지 구조

- `/` — 업체 공유용 공개 페이지 (읽기 전용, 실시간 업데이트)
- `/admin` — 스탭 전용 관리 페이지 (비밀번호: `smore2024`)

## Supabase 설정

Supabase 대시보드 > SQL Editor에서 아래 SQL 실행:

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_soldout BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO products (name) VALUES
  ('쿠키앤모어 다크카카오 쿠키'),
  ('쿠키앤모어 용감한 쿠키'),
  ('쿠키앤모어 미스틱플라워 쿠키'),
  ('쿠키앤모어 천사맛 쿠키'),
  ('쿠키앤모어 홀리베리 쿠키'),
  ('쿠키앤모어 달빛술사 쿠키'),
  ('쿠키앤모어 골드치즈 쿠키'),
  ('쿠키앤모어 퓨어바닐라 쿠키'),
  ('쿠키앤모어 밀키웨이맛 쿠키'),
  ('쿠키앤모어 버닝스파이스 쿠키'),
  ('쿠키앤모어 이터널슈가 쿠키'),
  ('쿠키앤모어 쉐도우밀크 쿠키'),
  ('쿠키앤모어 좀비맛 쿠키'),
  ('쿠키앤모어 세인트릴리 쿠키'),
  ('쿠키앤모어 사일런트솔트 쿠키'),
  ('쿠키앤모어 머랭 샌드 쿠키 세트(+랜덤아크릴키링)'),
  ('쿠키앤모어 소울잼 쿠키 세트 (에인션트 쿠키)'),
  ('쿠키앤모어 소울잼 쿠키 세트 (비스트 쿠키)');

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE products;
```

## Vercel 배포

1. GitHub에 이 레포 push
2. vercel.com에서 레포 import
3. Environment Variables 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!
