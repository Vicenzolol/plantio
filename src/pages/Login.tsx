import { useState } from 'react';
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonRouterLink,
  IonList,
  IonItem,
} from '@ionic/react';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      // O redirecionamento é feito pelo Router ao detectar a sessão.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <div className="auth-wrapper">
          <div className="auth-logo">
            <h1>Plantio</h1>
            <p>Gerencie seus plantões e horas</p>
          </div>

          <form onSubmit={submit}>
            <IonList inset>
              <IonItem>
                <IonInput
                  label="Email"
                  labelPlacement="stacked"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value ?? '')}
                  required
                />
              </IonItem>
              <IonItem>
                <IonInput
                  label="Senha"
                  labelPlacement="stacked"
                  type="password"
                  autocomplete="current-password"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value ?? '')}
                  required
                />
              </IonItem>
            </IonList>

            {error && (
              <IonText color="danger">
                <p className="ion-padding-start ion-padding-end">{error}</p>
              </IonText>
            )}

            <div className="ion-padding-start ion-padding-end">
              <IonButton expand="block" type="submit" disabled={busy}>
                {busy ? 'Entrando...' : 'Entrar'}
              </IonButton>
              <p className="ion-text-center">
                <IonText color="medium">Não tem conta? </IonText>
                <IonRouterLink routerLink="/register">Cadastre-se</IonRouterLink>
              </p>
            </div>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
}
