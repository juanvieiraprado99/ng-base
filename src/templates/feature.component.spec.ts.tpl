{{TEST_IMPORT}}import { ComponentFixture, TestBed } from '@angular/core/testing';
import { {{CLASS_NAME}} } from './{{FILE_STEM}}';

describe('{{CLASS_NAME}}', () => {
  let fixture: ComponentFixture<{{CLASS_NAME}}>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [{{CLASS_NAME}}],
    }).compileComponents();

    fixture = TestBed.createComponent({{CLASS_NAME}});
    fixture.detectChanges();
  });

  it('is created', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
