import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

import { GroupBuysService } from "../group-buys/group-buys.service";
import { RejectGroupBuyDto } from "../group-buys/dto/reject-group-buy.dto";
import { UpdateGroupBuyDto } from "../group-buys/dto/update-group-buy.dto";
import { ListGroupBuysDto } from "../group-buys/dto/list-group-buys.dto";
import { CreateInfluencerDto } from "../influencers/dto/create-influencer.dto";
import { UpdatePlaywrightCollectionDto } from "../influencers/dto/update-playwright-collection.dto";
import { InfluencersService } from "../influencers/influencers.service";
import { ListRawPostsDto } from "../raw-posts/dto/list-raw-posts.dto";
import { RawPostsService } from "../raw-posts/raw-posts.service";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

type AuthenticatedAdminRequest = {
  user: { userId: string };
};

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly influencersService: InfluencersService,
    private readonly rawPostsService: RawPostsService,
    private readonly groupBuysService: GroupBuysService,
    private readonly adminService: AdminService,
  ) {}

  @Get("influencers")
  listInfluencers() {
    return this.influencersService.listAll();
  }

  @Post("influencers")
  createInfluencer(@Body() dto: CreateInfluencerDto) {
    return this.influencersService.create(dto);
  }

  @Delete("influencers/:id")
  deleteInfluencer(@Param("id") id: string) {
    return this.influencersService.deactivate(id);
  }

  @Patch("influencers/:id/playwright-collection")
  updatePlaywrightCollection(
    @Param("id") id: string,
    @Body() dto: UpdatePlaywrightCollectionDto,
  ) {
    return this.influencersService.updatePlaywrightCollection(id, dto);
  }

  @Get("raw-posts")
  listRawPosts(@Query() query: ListRawPostsDto) {
    return this.rawPostsService.list(query);
  }

  @Get("group-buys")
  listGroupBuys(@Query() query: ListGroupBuysDto) {
    return this.groupBuysService.list({
      ...query,
      status: query.status ?? "REVIEW_REQUIRED",
    });
  }

  @Patch("group-buys/:id")
  updateGroupBuy(@Param("id") id: string, @Body() dto: UpdateGroupBuyDto) {
    return this.groupBuysService.updateAdmin(id, dto);
  }

  @Post("raw-posts/export")
  exportRawPosts() {
    return {
      message: "Use npm run export:raw-posts for filesystem JSONL export.",
    };
  }

  @Post("group-buys/import")
  importGroupBuys() {
    return {
      message:
        "Use npm run import:parsed-group-buys -- <file> for JSONL import.",
    };
  }

  @Post("group-buys/:id/approve")
  approve(
    @Param("id") id: string,
    @Request() request: AuthenticatedAdminRequest,
  ) {
    return this.groupBuysService.approve(id, request.user.userId);
  }

  @Post("group-buys/:id/reject")
  reject(
    @Param("id") id: string,
    @Body() dto: RejectGroupBuyDto,
    @Request() request: AuthenticatedAdminRequest,
  ) {
    return this.groupBuysService.reject(id, dto.reason, request.user.userId);
  }
}
