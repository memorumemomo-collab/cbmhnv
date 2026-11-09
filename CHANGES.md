# 변경 사항 (마무리 작업)

## 프론트
- `NovelList.tsx` : 작품 목록 최신순(updatedAt desc → 시트 행 번호 desc)
- `highlightService.ts` : localStorage 하이라이트 저장 제거(서버=시트가 유일한 원천), `reactToHighlight` 추가, 실패 시 boolean 반환
- `ReaderView.tsx` : 이모지/박수를 `sendReaction` 하나로 통합 → 내 행만 +1, 서버 값으로 보정, 실패 시 시트에서 재조회
- 미사용 의존성(@google/genai, express, dotenv, motion 등)과 firebase-applet-config.json 제거

## GAS (`src/data/gasScriptTemplate.ts` → 설정 화면에서 복사)
- `addHighlight` 는 id 기준 upsert (행 중복 방지)
- 신규 `reactHighlight` : (작품·화·문단·선택문·이모지·작성자) 기준 reactionCount +1, 없을 때만 행 생성 (LockService로 동시 클릭 보호)
- Highlights 탭 헤더를 16열로 자동 보정 (K~P열 헤더 누락 해결)
- 새 행은 텍스트 서식으로 저장 (날짜 자동변환, `=` 수식 해석 방지)
- 쓰기 실패를 `success:false` 로 반환 (기존엔 빈 catch 로 항상 success)
- `cleanupDuplicateHighlights()` : 과거 중복 행 1회 정리용 (수동 실행)

## 보안 (구글 로그인 토큰 검증, DB 없음/무료)
- 로그인: Google Identity Services 버튼 → ID 토큰 → GAS `login` 이 Google(tokeninfo)로 검증(aud·만료·email_verified) → 허용 목록 확인 → HMAC 서명 세션 토큰(30일) 발급. 서명키는 GAS 스크립트 속성에 자동 생성(DB 불필요).
- 모든 API 는 세션 토큰 필수. 이메일 자기신고 제거, 작성자(authorEmail)는 토큰 이메일로 강제.
- `isUserAllowed` fail-closed (시트 소유자/편집자/뷰어 + `Users` 시트 A열), 5분 캐시.
- 남의 하이라이트 수정/삭제 차단 (id upsert·delete 모두 작성자 확인).
- 제거: 하드코딩된 이메일 기본값, 시트 ID(템플릿에는 YOUR_SHEET_ID), 미사용 googleSheets/googleDocs 서비스.

## 설정 순서
1. Google Cloud Console → OAuth 동의 화면(외부, 게시 상태 '프로덕션') → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)
   승인된 JavaScript 원본: `https://<아이디>.github.io` (개발용 `http://localhost:3000`)
2. `src/config.ts` 와 GAS 의 `GOOGLE_CLIENT_ID` 에 같은 클라이언트 ID 입력
3. GAS 에 새 스크립트 붙여넣기 → `SHEET_ID` 를 내 시트 ID 로 수정 → 새 버전으로 재배포
4. 허용할 사람: 시트를 공유하거나, `Users` 시트 A열에 이메일 입력 (그룹/링크 공유는 자동 인식되지 않음)
