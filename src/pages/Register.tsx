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

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await register(name, email, password);
      // Após cadastrar, o Router leva para /setup (primeiro acesso).
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <div className="auth-wrapper">
          <div className="auth-logo">
            <h1>Criar conta</h1>
            <p>É rápido: nome, email e senha</p>
          </div>

          <form onSubmit={submit}>
            <IonList inset>
              <IonItem>
                <IonInput
                  label="Nome"
                  labelPlacement="stacked"
                  type="text"
                  autocomplete="name"
                  value={name}
                  onIonInput={(e) => setName(e.detail.value ?? '')}
                  required
                />
              </IonItem>
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
                  autocomplete="new-password"
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
                {busy ? 'Criando...' : 'Criar conta'}
              </IonButton>
              <p className="ion-text-center">
                <IonText color="medium">Já tem conta? </IonText>
                <IonRouterLink routerLink="/login">Entrar</IonRouterLink>
              </p>
            </div>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
}
