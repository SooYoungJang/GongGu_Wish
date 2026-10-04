import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CalendarQueryDto } from './dto/calendar-query.dto';
import { ListGroupBuysDto } from './dto/list-group-buys.dto';
import { GroupBuysService } from './group-buys.service';

@ApiTags('group-buys')
@Controller('group-buys')
export class GroupBuysController {
  constructor(private readonly groupBuysService: GroupBuysService) {}

  @Get()
  list(@Query() query: ListGroupBuysDto) {
    return this.groupBuysService.listPublic(query);
  }

  @Get('calendar')
  @ApiOperation({ summary: '캘린더 뷰용 공구 목록 (월간)' })
  calendar(@Query() query: CalendarQueryDto) {
    return this.groupBuysService.getCalendarView(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.groupBuysService.getPublic(id);
  }
}
