export default function ChannelsPage() {
  // Page canaux désactivée côté client : la configuration Meta est gérée uniquement
  // par le superadmin dans le dashboard administrateur.
  return (
    <div className="p-6 text-sm text-slate-300">
      <h1 className="text-lg font-semibold text-white">
        Configuration des canaux désactivée
      </h1>
      <p className="mt-3">
        La configuration de WhatsApp, Messenger et Facebook est désormais gérée
        exclusivement par l&apos;équipe Arcc En Ciel via le dashboard superadmin.
      </p>
      <p className="mt-2">
        Si vous souhaitez ajouter ou modifier une connexion Meta, merci de
        contacter le support ou votre interlocuteur Arcc En Ciel.
      </p>
    </div>
  );
}
