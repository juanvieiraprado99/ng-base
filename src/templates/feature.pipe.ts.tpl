import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: '{{PIPE_NAME}}' })
export class {{CLASS_NAME}} implements PipeTransform {
  transform(value: unknown): unknown {
    return value;
  }
}
