import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HomeScreenPromptComponent } from './components/home-screen-prompt/home-screen-prompt.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HomeScreenPromptComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
}
