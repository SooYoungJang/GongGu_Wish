import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ListGroupBuysDto } from '../group-buys/dto/list-group-buys.dto';
import { GroupBuysService } from '../group-buys/group-buys.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly groupBuysService: GroupBuysService) {}

  @Get()
  search(@Query() query: ListGroupBuysDto) {
    return this.groupBuysService.listPublic(query);
  }
}
