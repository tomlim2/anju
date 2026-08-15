# bat — UE 프로젝트 운영 (Windows)

**UE 관련: 예.** CINEVStudio(`gitlab.cinamon.me/cinev/CINEVStudio.git`) 레포의 Git/LFS 운영과
에디터 헤드리스 실행용 배치 스크립트. 에디터 안에서 도는 스크립트가 아니라 **셸에서 실행**한다.

같은 용도의 다른 플랫폼 구현: [`../ps1/`](../ps1/README.md) (PowerShell), [`../sh/`](../sh/README.md) (Bash)

## 어디에 있나

- CINEVStudio를 클론하려면? → [`clone_git.bat`](clone_git.bat) — `art/main-s1` 단일 브랜치, longpaths·LFS 동시전송 128 설정 포함
- LFS 설치와 lock verify 설정은? → [`lfs_config.bat`](lfs_config.bat)
- 오래된 LFS 오브젝트를 지우려면? → [`prune_git.bat`](prune_git.bat)
- 리다이렉터를 에디터 없이 정리하려면? → [`redirector_headless.bat`](redirector_headless.bat) — `UnrealEditor.exe -run=ResavePackages -fixupredirects`
- 로컬 변경을 전부 되돌리려면? → [`reset_git.bat`](reset_git.bat)
- 파일 읽기 전용 속성을 풀려면? → [`uncheck_read_only.bat`](uncheck_read_only.bat)

## 알려진 문제

- `config_git.bat` — 빈 파일이다.
- `redirector_headless.bat` — 엔진·프로젝트 경로(`D:\unreal\base\UE_5.3`, `E:\CINEVStudio`)가 하드코딩돼 있다.
