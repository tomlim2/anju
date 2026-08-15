# ps1 — UE 프로젝트 운영 (PowerShell)

**UE 관련: 예.** CINEVStudio 레포의 아트 브랜치 생성과 LFS lock 해제. 셸에서 실행한다.

같은 용도의 다른 플랫폼 구현: [`../bat/`](../bat/README.md) (배치), [`../sh/`](../sh/README.md) (Bash)

## 어디에 있나

- 아트 브랜치(`env-`/`anime-`/`lit-`)를 한 번에 만들려면? → [`create_art_branches.ps1`](create_art_branches.ps1)
- LFS lock을 전부 해제하려면? → [`unlock_all.ps1`](unlock_all.ps1)
- 콘텐츠 lock을 전부 해제하려면? → [`unlock_all_contents.ps1`](unlock_all_contents.ps1)
- 특정 팀원의 lock만 해제하려면? → [`unlock_all_contents_by_name.ps1`](unlock_all_contents_by_name.ps1)

## 알려진 문제

- `unlock_all.ps1`과 `unlock_all_contents.ps1`은 도입부 로직이 거의 같다. 통합 여지가 있다.
- `unlock_all_contents_by_name.ps1`에 팀원 계정명 6개가 하드코딩돼 있다.
- 브랜치 버전(`0.7.0`)이 `create_art_branches.ps1` 안에 상수로 박혀 있다.
