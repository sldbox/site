/*
=============================================================================
[파일 설명서] sw.js (PWA 캐시 암살 및 서비스 워커 자폭 스크립트)
이 스크립트는 브라우저에 저장된 모든 캐시를 강제로 삭제하고 
서비스 워커 등록을 해제하여 사용자가 최신 웹 코드를 받도록 강제합니다.
=============================================================================
*/

// 1. 설치 단계: 대기 없이 즉시 활성화 단계로 넘어감
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// 2. 활성화 단계: 모든 캐시 저장소를 삭제하고 제어권 반납
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // 모든 캐시 스토리지 삭제
            caches.keys().then((keys) => {
                return Promise.all(keys.map((key) => caches.delete(key)));
            }),
            // 즉시 모든 클라이언트(탭)의 제어권 획득
            self.clients.claim()
        ]).then(() => {
            // 서비스 워커 자체 등록 해제 (자폭)
            self.registration.unregister().then(() => {
                console.log('[SW] 모든 캐시가 삭제되었으며 서비스 워커가 성공적으로 해제되었습니다.');
            });
        })
    );
});

// 3. 페치(Fetch) 이벤트: 네트워크 요청을 가로채지 않고 서버로 직접 보냄
self.addEventListener('fetch', (event) => {
    // 아무것도 하지 않고 통과시켜 서버의 최신 데이터를 가져오게 함
    return;
});