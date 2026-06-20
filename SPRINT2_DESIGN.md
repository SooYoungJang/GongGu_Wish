# Sprint 2 설계 문서: GongguSubmission 기반 제보/승인 API

**작성일**: 2026-06-14  
**작성자**: AI Assistant (dami-pm profile)  
**대상**: 김다미 PM  
**프로젝트**: RN_GongGu_Wish (Expo RN 0.83 + NestJS + Prisma + PostgreSQL + Redis)

---

## 1. 배경 및 목표

### 현재 상황
- **Sprint 5**: Instagram Worker가 IP blacklist로 차단됨 (데이터센터 프록시 사용)
- **대안**: 크롤링 대신 **사용자 제보 + 운영자 승인 큐** 방식 도입
- **핵심 변경**: `RawPost` 수집 경로가 Instagram 크롤러 → **GongguSubmission API**로 전환

### Sprint 2 목표
1. **GongguSubmission 모델** 추가 (Prisma schema)
2. **제보 API** (`POST /submissions`) - 익명/회원 모두 가능
3. **운영자 승인 큐 API** (`GET /admin/submissions`, `POST /admin/submissions/:id/approve|reject`)
4. **승인 시 GroupBuy 자동 생성** 및 캘린더 반영 로직
5. **중복 제보 방지** (content hash 기반)
6. **Swagger 문서화** 및 **단위/통합 테스트** 작성

---

## 2. 데이터 모델 설계

### 2.1 Prisma Schema 변경 사항 (`apps/api/prisma/schema.prisma`)

```prisma
// === 새로 추가할 모델 ===

enum SubmissionStatus {
  PENDING       // 접수됨, 검토 대기
  APPROVED      // 승인됨 -> GroupBuy 생성됨
  REJECTED      // 반려됨
  DUPLICATE     // 중복 제보로 병합됨
}

model GongguSubmission {
  id              String            @id @default(uuid())
  // 제보 내용 (필수)
  productName     String            @map("product_name")        // 제품명
  brandName       String?           @map("brand_name")          // 브랜드명 (선택)
  startDate       DateTime?         @map("start_date")          // 공구 시작일
  endDate         DateTime?         @map("end_date")            // 공구 마감일
  purchaseUrl     String?           @map("purchase_url")        // 구매 링크
  discountInfo    String?           @map("discount_info")       // 할인 정보
  summary         String?           @map("summary")             // 한 줄 요약
  instagramUrl    String?           @map("instagram_url")       // 원본 인스타그램 포스트 URL (참고용)
  imageUrls       String[]          @default([]) @map("image_urls") // 이미지 URL 배열 (최대 5개)

  // 제보자 정보
  reporterName    String?           @map("reporter_name")       // 제보자 닉네임/이름 (익명 가능)
  reporterContact String?           @map("reporter_contact")    // 연락처 (이메일/카카오톡 ID 등, 선택)
  isAnonymous     Boolean           @default(true) @map("is_anonymous")

  // 중복 검출용
  contentHash     String            @unique @map("content_hash") // 핵심 필드 해시

  // 상태 관리
  status          SubmissionStatus  @default(PENDING)
  adminMemo       String?           @map("admin_memo")          // 운영자 메모
  reviewedAt      DateTime?         @map("reviewed_at")
  reviewedBy      String?           @map("reviewed_by")         // 운영자 ID (향후 User 연동)

  // 승인 시 생성된 GroupBuy 참조
  groupBuyId      String?           @unique @map("group_buy_id")
  groupBuy        GroupBuy?         @relation(fields: [groupBuyId], references: [id], onDelete: SetNull)

  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  @@index([status])
  @@index([createdAt])
  @@index([productName])
  @@map("gonggu_submissions")
}

// === 기존 GroupBuy 모델에 필드 추가 ===
model GroupBuy {
  // ... 기존 필드 유지 ...
  
  // 🔽 새로 추가 (제보 출처 추적)
  sourceType      String?           @default("CRAWLED") @map("source_type") // CRAWLED | SUBMISSION
  submissionId    String?           @unique @map("submission_id")
  submission      GongguSubmission? @relation(fields: [submissionId], references: [id], onDelete: SetNull)
  
  // 캘린더용 필드 (기존 startDate/endDate 활용)
  // allDay 필드 추가 고려 (종일 일정 여부)
  isAllDay        Boolean           @default(false) @map("is_all_day")
  
  @@index([sourceType])
}
```

### 2.2 contentHash 생성 규칙 (`apps/api/src/submissions/hash.ts`)

```typescript
import { createHash } from 'node:crypto';

export interface SubmissionHashInput {
  productName: string;
  startDate?: string | Date;  // ISO string 또는 Date
  purchaseUrl?: string;
}

export function createSubmissionHash(input: SubmissionHashInput): string {
  // 정규화: 소문자, 공백 제거, 날짜 포맷 통일
  const normalized = {
    productName: input.productName.toLowerCase().replace(/\s+/g, ''),
    startDate: input.startDate ? new Date(input.startDate).toISOString().split('T')[0] : '',
    purchaseUrl: input.purchaseUrl?.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') || '',
  };
  
  const payload = `${normalized.productName}|${normalized.startDate}|${normalized.purchaseUrl}`;
  return createHash('sha256').update(payload).digest('hex');
}
```

---

## 3. API 엔드포인트 설계

### 3.1 공개 제보 API (인증 불필요)

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/submissions` | 공구 제보 접수 |
| `GET` | `/submissions/:id` | 제보 상세 조회 (본인 확인용, 추후 인증 추가 시) |

### 3.2 운영자 전용 API (Admin Guard 필요)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/admin/submissions` | 제보 목록 조회 (필터: status, 날짜, 검색어) |
| `GET` | `/admin/submissions/:id` | 제보 상세 조회 |
| `POST` | `/admin/submissions/:id/approve` | 승인 → GroupBuy 생성 |
| `POST` | `/admin/submissions/:id/reject` | 반려 (사유 필수) |
| `POST` | `/admin/submissions/:id/merge` | 중복 병합 (대상 submission ID 지정) |

---

## 4. DTO 및 Validation 설계

### 4.1 제보 생성 DTO (`apps/api/src/submissions/dto/create-submission.dto.ts`)

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsArray, IsBoolean, IsDateString, MaxLength, MinLength, ArrayMaxSize, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSubmissionDto {
  @ApiProperty({ example: '마롱드파리 크로와상 6입', description: '제품명 (필수)' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  productName: string;

  @ApiPropertyOptional({ example: '마롱드파리', description: '브랜드명' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brandName?: string;

  @ApiPropertyOptional({ example: '2026-06-20', description: '공구 시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-27', description: '공구 마감일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://smartstore.naver.com/...', description: '구매 링크' })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o) => o.purchaseUrl && o.purchaseUrl.length > 0)
  purchaseUrl?: string;

  @ApiPropertyOptional({ example: '정가 25,000원 → 18,900원 (24% 할인)', description: '할인 정보' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountInfo?: string;

  @ApiPropertyOptional({ example: '버터 향 가득한 정통 크로와상, 냉동 보관 가능', description: '한 줄 요약' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ example: 'https://www.instagram.com/p/ABC123/', description: '원본 인스타그램 포스트 URL' })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o) => o.instagramUrl && o.instagramUrl.length > 0)
  instagramUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['https://img1.jpg', 'https://img2.jpg'], description: '이미지 URL 배열 (최대 5개)' })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(5)
  imageUrls?: string[];

  @ApiPropertyOptional({ example: '김공구', description: '제보자 닉네임 (익명 시 생략)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  reporterName?: string;

  @ApiPropertyOptional({ example: 'gonggu@email.com', description: '연락처 (이메일/카카오톡 ID)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reporterContact?: string;

  @ApiPropertyOptional({ example: true, description: '익명 제보 여부 (기본 true)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isAnonymous?: boolean = true;
}
```

### 4.2 제보 목록 조회 DTO (`apps/api/src/submissions/dto/list-submissions.dto.ts`)

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SubmissionStatus } from '@prisma/client';

export class ListSubmissionsDto {
  @ApiPropertyOptional({ enum: SubmissionStatus, description: '상태 필터' })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @ApiPropertyOptional({ example: '크로와상', description: '제품명/브랜드 검색' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: '2026-06-01', description: '생성일 시작' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: '생성일 종료' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 20, description: '페이지 크기 (최대 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0, description: '오프셋' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ enum: ['createdAt', 'productName'], default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'productName' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
```

### 4.3 승인/반려 DTO (`apps/api/src/submissions/dto/review-submission.dto.ts`)

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class ApproveSubmissionDto {
  @ApiPropertyOptional({ example: true, description: '캘린더에 종일 일정으로 표시' })
  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean = false;

  @ApiPropertyOptional({ example: '자동 승인: 신뢰도 높음', description: '운영자 메모' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminMemo?: string;
}

export class RejectSubmissionDto {
  @ApiProperty({ example: '정보 부족 (구매 링크 없음)', description: '반려 사유 (필수)' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ example: '구매 링크와 마감일을 추가해 주시면 재검토 가능합니다.', description: '제보자 안내 메시지' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  guideMessage?: string;
}

export class MergeSubmissionDto {
  @ApiProperty({ example: 'uuid-of-duplicate-submission', description: '병합할 대상 제보 ID' })
  @IsString()
  targetId: string;
}
```

---

## 5. 비즈니스 로직 상세

### 5.1 중복 제보 처리 전략

```
제보 접수 시:
1. contentHash 생성 (productName + startDate + purchaseUrl 기반)
2. DB에서 동일 contentHash 조회
   - 없음: 신규 생성 (status: PENDING)
   - 있음 & status == PENDING: 기존 제보에 카운트 증가, 최신 정보 병합 옵션
   - 있음 & status == APPROVED: "이미 승인된 공구입니다" 응답 (groupBuyId 반환)
   - 있음 & status == REJECTED: "이전에 반려된 건입니다" 안내 (재제보 허용 여부 정책 결정)
   - 있음 & status == DUPLICATE: 원본 제보 ID 반환
```

```typescript
// apps/api/src/submissions/submissions.service.ts 핵심 로직
async create(dto: CreateSubmissionDto) {
  const contentHash = createSubmissionHash({
    productName: dto.productName,
    startDate: dto.startDate,
    purchaseUrl: dto.purchaseUrl,
  });

  // 중복 확인
  const existing = await this.prisma.gongguSubmission.findUnique({
    where: { contentHash },
    include: { groupBuy: true },
  });

  if (existing) {
    switch (existing.status) {
      case SubmissionStatus.PENDING:
        // 기존 제보 업데이트 (이미지 추가, 정보 보완 등)
        return this.updateExistingSubmission(existing, dto);
      case SubmissionStatus.APPROVED:
        throw new ConflictException({
          message: '이미 승인된 공구입니다.',
          groupBuyId: existing.groupBuyId,
          submissionId: existing.id,
        });
      case SubmissionStatus.REJECTED:
        // 재제보 허용: 새 제보로 생성하되 reference 남김
        return this.createAsResubmission(dto, contentHash, existing.id);
      case SubmissionStatus.DUPLICATE:
        // 원본 제보로 리다이렉트
        const original = await this.prisma.gongguSubmission.findUnique({
          where: { id: existing.id },
        });
        throw new ConflictException({
          message: '중복 제보입니다. 원본 제보를 확인해 주세요.',
          originalSubmissionId: original?.id,
        });
    }
  }

  // 신규 생성
  return this.prisma.gongguSubmission.create({
    data: {
      ...dto,
      contentHash,
      imageUrls: dto.imageUrls ?? [],
      isAnonymous: dto.isAnonymous ?? true,
    },
  });
}
```

### 5.2 승인 시 GroupBuy/Calendar 반영 로직

```
POST /admin/submissions/:id/approve
1. Submission 조회 (status === PENDING 확인)
2. 트랜잭션 시작
3. GroupBuy 생성:
   - rawPostId: NULL (제보 기반이므로 RawPost 없음)
   - sourceType: 'SUBMISSION'
   - submissionId: submission.id
   - productName, brandName, startDate, endDate, purchaseUrl, discountInfo, summary
   - confidence: 0.9 (제보 기반이므로 높은 신뢰도)
   - status: APPROVED
   - isAllDay: dto.isAllDay ?? false
4. Submission 업데이트:
   - status: APPROVED
   - groupBuyId: 생성된 GroupBuy.id
   - reviewedAt: now()
   - reviewedBy: currentAdminId (향후 구현)
   - adminMemo: dto.adminMemo
5. 트랜잭션 커밋
6. 알림 발송 (선택: 제보자의 reporterContact가 이메일인 경우)
7. 응답: { groupBuy, submission }
```

```typescript
// apps/api/src/submissions/submissions.service.ts
async approve(id: string, dto: ApproveSubmissionDto, adminId: string) {
  return this.prisma.$transaction(async (tx) => {
    const submission = await tx.gongguSubmission.findUnique({
      where: { id },
    });

    if (!submission) throw new NotFoundException('제보를 찾을 수 없습니다.');
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException(`이미 ${submission.status} 처리된 제보입니다.`);
    }

    // GroupBuy 생성
    const groupBuy = await tx.groupBuy.create({
      data: {
        // rawPostId: null (제보 기반)
        sourceType: 'SUBMISSION',
        submissionId: submission.id,
        productName: submission.productName,
        brandName: submission.brandName,
        startDate: submission.startDate ? new Date(submission.startDate) : null,
        endDate: submission.endDate ? new Date(submission.endDate) : null,
        purchaseUrl: submission.purchaseUrl,
        discountInfo: submission.discountInfo,
        summary: submission.summary,
        confidence: 0.9,
        status: GroupBuyStatus.APPROVED,
        isAllDay: dto.isAllDay ?? false,
      },
    });

    // Submission 상태 업데이트
    const updated = await tx.gongguSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.APPROVED,
        groupBuyId: groupBuy.id,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        adminMemo: dto.adminMemo,
      },
      include: { groupBuy: true },
    });

    return { groupBuy, submission: updated };
  });
}
```

### 5.3 캘린더 조회 API 확장 (기존 GroupBuysController 활용)

```typescript
// apps/api/src/group-buys/group-buys.controller.ts 에 추가
@Get('calendar')
@ApiOperation({ summary: '캘린더 뷰용 공구 목록 (월간/주간)' })
async getCalendarView(@Query() query: CalendarQueryDto) {
  return this.groupBuysService.getCalendarView(query);
}

// DTO
export class CalendarQueryDto {
  @IsOptional() @IsDateString() yearMonth?: string; // "2026-06"
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(GroupBuyStatus) status?: GroupBuyStatus = GroupBuyStatus.APPROVED;
}

// Service: startDate~endDate 범위가 쿼리 기간과 겹치는 항목 반환
```

---

## 6. 예상 파일 구조

```
apps/api/src/
├── prisma/
│   └── schema.prisma                    ← 모델 추가 (GongguSubmission, GroupBuy 필드)
├── submissions/                         ← 🆕 신규 모듈
│   ├── submissions.module.ts
│   ├── submissions.controller.ts
│   ├── submissions.service.ts
│   ├── dto/
│   │   ├── create-submission.dto.ts
│   │   ├── list-submissions.dto.ts
│   │   ├── review-submission.dto.ts
│   │   └── index.ts
│   ├── hash.ts                          ← contentHash 생성 유틸
│   ├── submissions.module.ts
│   └── submissions.controller.spec.ts   ← 통합 테스트
├── group-buys/
│   ├── group-buys.service.ts            ← approve/refect 로직 이동, calendar 뷰 추가
│   ├── group-buys.controller.ts         ← /calendar 엔드포인트 추가
│   └── dto/
│       └── calendar-query.dto.ts        ← 🆕
├── admin/
│   ├── admin.controller.ts              ← /admin/submissions 엔드포인트 추가
│   └── admin.module.ts                  ← SubmissionsModule import
├── app.module.ts                        ← SubmissionsModule 등록
└── main.ts                              ← 기존 유지
```

### 6.1 모듈 등록 (`apps/api/src/submissions/submissions.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
```

### 6.2 Admin 모듈에 등록 (`apps/api/src/admin/admin.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { InfluencersModule } from '../influencers/influencers.module';
import { RawPostsModule } from '../raw-posts/raw-posts.module';
import { GroupBuysModule } from '../group-buys/group-buys.module';
import { SubmissionsModule } from '../submissions/submissions.module';  // 🔽 추가

@Module({
  imports: [InfluencersModule, RawPostsModule, GroupBuysModule, SubmissionsModule],
  controllers: [AdminController],
})
export class AdminModule {}
```

---

## 7. 테스트 항목

### 7.1 단위 테스트

| 대상 | 테스트 케이스 |
|------|--------------|
| `createSubmissionHash` | 동일 제품명/날짜/URL → 동일 해시, 대소문자/공백 무시 검증 |
| `SubmissionsService.create` | 신규 생성, PENDING 중복 병합, APPROVED 중복 에러, REJECTED 재제보 |
| `SubmissionsService.approve` | GroupBuy 생성 확인, submission 상태 변경, 트랜잭션 롤백 검증 |
| `SubmissionsService.reject` | 상태 변경, 반려 사유 저장 |
| `SubmissionsService.list` | 필터(status, 날짜, 검색어), 페이지네이션, 정렬 |

### 7.2 통합 테스트 (e2e)

```typescript
// apps/api/test/submissions.e2e-spec.ts
describe('Submissions API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /submissions', () => {
    it('유효한 제보로 201 반환', async () => {
      const dto = { productName: '테스트 크로와상', startDate: '2026-07-01', purchaseUrl: 'https://shop.com' };
      const res = await request(app.getHttpServer()).post('/submissions').send(dto).expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
    });

    it('필수 필드 누락 시 400', async () => {
      await request(app.getHttpServer()).post('/submissions').send({}).expect(400);
    });

    it('중복 제보 시 ConflictException (APPROVED 상태)', async () => {
      // 1. 제보 생성 → 승인
      // 2. 동일 해시로 재제보 → 409 + groupBuyId 반환
    });

    it('이미지 URL 5개 초과 시 400', async () => {
      const dto = { productName: '테스트', imageUrls: Array(6).fill('https://img.jpg') };
      await request(app.getHttpServer()).post('/submissions').send(dto).expect(400);
    });
  });

  describe('Admin: POST /admin/submissions/:id/approve', () => {
    it('승인 시 GroupBuy 생성 및 캘린더 반영', async () => {
      // 1. 제보 생성
      // 2. 승인 요청
      // 3. GroupBuy 조회 확인 (sourceType=SUBMISSION, status=APPROVED)
      // 4. Submission.status === APPROVED, groupBuyId 설정 확인
    });

    it('이미 처리된 제보 승인 시 400', async () => {
      // 승인된 제보 재승인 시도 → BadRequestException
    });
  });

  describe('GET /group-buys/calendar', () => {
    it('월간 캘린더 뷰 데이터 반환', async () => {
      const res = await request(app.getHttpServer())
        .get('/group-buys/calendar')
        .query({ yearMonth: '2026-07' })
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      // 각 항목에 startDate, endDate, isAllDay 포함 확인
    });
  });
});
```

### 7.3 수동 테스트 시나리오

| 시나리오 | 예상 결과 |
|----------|-----------|
| 익명 사용자가 최소 필드만으로 제보 | 201 Created, status=PENDING |
| 동일한 제품/날짜/링크로 재제보 (PENDING) | 기존 제보 반환, duplicate: true |
| 동일한 제품/날짜/링크로 재제보 (APPROVED) | 409 Conflict, 기승인 GroupBuy ID 반환 |
| 운영자가 승인 (isAllDay=true) | GroupBuy 생성, isAllDay=true, 캘린더에 종일 일정으로 표시 |
| 운영자가 반려 (사유 입력) | status=REJECTED, 반려 사유 저장 |
| 캘린더 API 호출 (yearMonth=2026-07) | 해당 월에 걸친 공구만 반환, startDate/endDate/isAllDay 포함 |

---

## 8. 마이그레이션 계획

```bash
# 1. Prisma 스키마 수정 후
cd apps/api
npx prisma migrate dev --name add_gonggu_submission

# 2. Prisma Client 재생성
npx prisma generate

# 3. 빌드 확인
npm run build

# 4. 테스트 실행
npm run test
npm run test:e2e  # (e2e 테스트 설정 시)
```

---

## 9. 향후 확장 고려사항 (Sprint 3+)

1. **알림 연동**: 제보 승인/반려 시 이메일/카카오톡/푸시 알림 (기존 `NotificationsModule` 활용)
2. **이미지 업로드**: 외부 URL 대신 직접 업로드 (S3/Cloudinary 연동)
3. **제보자 인증**: 이메일 인증 코드로 본인 확인 후 수정/삭제 허용
4. **자동 중복 병합**: 유사도 기반(Levenshtein/Embedding) 중복 감지
5. **캘린더 구독**: iCal/Google Calendar 연동 (public read-only feed)
6. **관리자 대시보드**: 통계(일일 제보 수, 승인율, 평균 처리 시간)

---

## 10. 위험 요소 및 대응

| 위험 | 영향도 | 대응 방안 |
|------|--------|-----------|
| 제보 스팸/남용 | 높음 | Rate limiting (IP당 일 10회), hCaptcha 도입 검토 |
| 허위 제보로 잘못된 공구 노출 | 높음 | 운영자 승인 필수, 반려 사유 필수화, 제보자 평판 시스템 장기 검토 |
| 중복 해시 충돌 (극히 드묾) | 낮음 | SHA-256 64자, 제품명+날짜+URL 조합으로 충돌 확률 무시 가능 |
| 캘린더 성능 (데이터 증가 시) | 중간 | 인덱스 최적화(`startDate`, `endDate`), 페이지네이션 필수, 캐싱(Redis) 도입 |

---

## 11. 승인 요청

PM님, 위 설계안 검토 후 다음 사항 확정 부탁드립니다:

1. **제보 필수 필드**: 현재 `productName`만 필수 → `startDate`도 필수로 할지?
2. **익명 제보 정책**: `isAnonymous` 기본값 `true` 유지, 연락처 필수 여부?
3. **이미지 저장 방식**: 외부 URL만 허용 → 향후 직접 업로드 지원 시 마이그레이션 계획 필요
4. **중복 제보 시 UX**: 프론트엔드에서 "이미 제보된 공구입니다" 안내 후 기존 제보 상세로 이동할지?
5. **캘린더 API 응답 형태**: 월간 뷰용 평탄화된 배열 vs. 날짜별 그룹핑 객체?

---

**문서 버전**: v1.0  
**다음 단계**: PM 확정 → 구현 태스크 분할 (Jira/GitHub Issues) → Sprint 2 개발 착수