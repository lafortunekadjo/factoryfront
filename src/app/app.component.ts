import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class AppComponent implements OnInit {
  private translate = inject(TranslateService);
  private auth = inject(AuthService);

  ngOnInit() {
    const userLang = this.auth.user()?.preferredLanguage ?? 'fr';
    this.translate.setDefaultLang('fr');
    this.translate.use(userLang);
  }
}
