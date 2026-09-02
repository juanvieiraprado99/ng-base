{{TEST_IMPORT}}import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { {{CLASS_NAME}} } from './{{FILE_STEM}}';

describe('{{CLASS_NAME}}', () => {
  let service: {{CLASS_NAME}};

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject({{CLASS_NAME}});
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });
});
