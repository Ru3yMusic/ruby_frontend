import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibRubyCoreUi } from './lib-ruby-core-ui';

describe('LibRubyCoreUi', () => {
  let component: LibRubyCoreUi;
  let fixture: ComponentFixture<LibRubyCoreUi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibRubyCoreUi],
    }).compileComponents();

    fixture = TestBed.createComponent(LibRubyCoreUi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
