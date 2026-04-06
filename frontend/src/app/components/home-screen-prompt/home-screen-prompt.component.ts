import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const STORAGE_KEY = 'homeScreenPromptDismissed';

@Component({
  selector: 'app-home-screen-prompt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-screen-prompt.component.html',
  styleUrl: './home-screen-prompt.component.scss',
})
export class HomeScreenPromptComponent implements OnInit {
  visible = false;
  dontShowAgain = false;
  platform: 'ios' | 'android' | null = null;

  ngOnInit(): void {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (!isIOS && !isAndroid) return;

    this.platform = isIOS ? 'ios' : 'android';
    this.visible = true;
  }

  dismiss(): void {
    if (this.dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    this.visible = false;
  }
}
