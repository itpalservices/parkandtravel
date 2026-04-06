import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HomeScreenPromptComponent } from './components/home-screen-prompt/home-screen-prompt.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HomeScreenPromptComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
}
