import './About.css';
import { t } from '@stores';

export default function() {
  return (
    <div class="about">
      <strong>Loudara</strong>
      <br />
      {t('about_description')}
      <br />
      <span>{t('about_learn_more')}</span>
    </div >
  );
}
