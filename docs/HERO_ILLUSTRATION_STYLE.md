# 매거진 hero 일러스트 스타일 가이드 (락)

**일러스트 결은 항상 일관 유지. 매번 결이 바뀌면 안 됨.**

스크립트 (`scripts/generate-story-hero.mts`)의 `STYLE_SUFFIX` 상수가 모든 prompt 끝에 자동 append. 결 변경 시 그 한 곳만 수정.

## 고정 룰

| 요소 | 결 |
|---|---|
| **캐릭터** | chibi 3D Pixar 두루미 (master.png 결) — white feathers, coral pink crest, coral pink beak, large round cartoon eyes, chibi proportions |
| **배경** | warm pastel cream + subtle coral accents (밤 결은 deep navy + cream 별·달, 단 cream·coral 결 통일) |
| **조명** | soft golden-amber from upper-left |
| **텍스처** | fine film grain, shallow depth of field |
| **결** | premium editorial magazine hero illustration (NYT magazine / Toss Feed editorial) |
| **비율** | 16:9 horizontal |

## 금지 (negative)

- 한자·한글·숫자·글자
- 다른 동물 (두루미 외)
- 사람 얼굴
- 사진처럼 realistic 텍스처
- 무서운·위협 결

## 매번 글마다 다른 부분 (자유)

- **메타포 prop**: 글 주제에 맞게 (동전·뱀·붉은 실 등)
- **두루미 자세·표정·위치**: 글 주제에 맞게 자연스럽게
- **배경 분위기**: 낮 vs 밤 (cream vs navy + 별·달) — 단 cream·coral 톤은 유지
- **메타포 크기·구성**: 자유

## 새 hero 생성 명령

```bash
npx tsx scripts/generate-story-hero.mts --slug <slug> --prompt "<scene description>"

# 옵션:
#   --force    : 기존 파일 재생성
#   --no-ref   : master.png 두루미 ref 없이 (메타포 only)
```

`STYLE_SUFFIX`가 자동 append되니까 prompt에는 **scene description만** 박으면 됨.

## prompt 작성 예시

```
"두루미가 코랄 복주머니를 들고 동전이 흘러내리는 결, 바닥에 갈라진 틈이 있음. 두루미는 정면 약간 좌측, 동전이 우측으로 떨어짐."
```

→ 스크립트가 자동으로 `STYLE_SUFFIX` append → 항상 같은 톤으로 박힘.

## 결 변경 시

1. `scripts/generate-story-hero.mts`의 `STYLE_SUFFIX` 수정
2. 기존 3편 다 `--force`로 재생성 (일관성 유지)
3. 이 문서도 같이 갱신
