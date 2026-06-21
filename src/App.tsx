import { IonApp, IonRouterOutlet, IonSpinner } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { DataProvider } from './lib/data';
import Login from './pages/Login';
import Register from './pages/Register';
import Setup from './pages/Setup';
import Tabs from './pages/Tabs';

function Routes() {
  const { user, hasSchedule, loading } = useAuth();

  if (loading) {
    return (
      <div className="center-spinner">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  // Não autenticado
  if (!user) {
    return (
      <Switch>
        <Route exact path="/login" component={Login} />
        <Route exact path="/register" component={Register} />
        <Route render={() => <Redirect to="/login" />} />
      </Switch>
    );
  }

  // Autenticado mas sem escala -> primeiro acesso
  if (!hasSchedule) {
    return (
      <Switch>
        <Route exact path="/setup" component={Setup} />
        <Route render={() => <Redirect to="/setup" />} />
      </Switch>
    );
  }

  // Autenticado com escala
  return (
    <Switch>
      <Route path="/tabs" component={Tabs} />
      <Route render={() => <Redirect to="/tabs/dashboard" />} />
    </Switch>
  );
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <DataProvider>
          <IonReactRouter>
            <IonRouterOutlet>
              <Routes />
            </IonRouterOutlet>
          </IonReactRouter>
        </DataProvider>
      </AuthProvider>
    </IonApp>
  );
}
