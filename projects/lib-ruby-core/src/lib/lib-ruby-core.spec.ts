import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibRubyCore } from './lib-ruby-core';

describe('LibRubyCore', () => {
  let component: LibRubyCore;
  let fixture: ComponentFixture<LibRubyCore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibRubyCore],
    }).compileComponents();

    fixture = TestBed.createComponent(LibRubyCore);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
