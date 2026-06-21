import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import { Redirect, Route } from 'react-router-dom';
import { homeOutline, timeOutline, calendarOutline, personOutline } from 'ionicons/icons';
import Dashboard from './Dashboard';
import Hours from './Hours';
import Calendar from './Calendar';
import Profile from './Profile';

export default function Tabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/dashboard" component={Dashboard} />
        <Route exact path="/tabs/hours" component={Hours} />
        <Route exact path="/tabs/calendar" component={Calendar} />
        <Route exact path="/tabs/profile" component={Profile} />
        <Route exact path="/tabs">
          <Redirect to="/tabs/dashboard" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="dashboard" href="/tabs/dashboard">
          <IonIcon icon={homeOutline} />
          <IonLabel>Início</IonLabel>
        </IonTabButton>
        <IonTabButton tab="hours" href="/tabs/hours">
          <IonIcon icon={timeOutline} />
          <IonLabel>Horas</IonLabel>
        </IonTabButton>
        <IonTabButton tab="calendar" href="/tabs/calendar">
          <IonIcon icon={calendarOutline} />
          <IonLabel>Agenda</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/tabs/profile">
          <IonIcon icon={personOutline} />
          <IonLabel>Perfil</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
