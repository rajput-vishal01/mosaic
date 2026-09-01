import { getAcceptableInvitation } from "@/lib/agencies/invitations";
import { AcceptInvitationForm } from "./accept-form";
import { ExistingAccountForm } from "./existing-account-form";

export default async function AcceptInvitationPage({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  const invitation = await getAcceptableInvitation(invitationId);
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12"><section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{invitation ? <><p className="text-sm font-medium text-slate-500">Invitation to {invitation.organizationName}</p><h1 className="mt-1 text-xl font-semibold tracking-tight">{invitation.existingUserId ? "Join with your Mosaic account" : "Create your Mosaic account"}</h1><p className="mt-2 text-sm leading-6 text-slate-500">This invitation is for <span className="font-medium text-slate-700">{invitation.email}</span>.</p><div className="mt-6">{invitation.existingUserId ? <ExistingAccountForm email={invitation.email} invitationId={invitation.id} /> : <AcceptInvitationForm invitationId={invitation.id} />}</div></> : <><h1 className="text-xl font-semibold tracking-tight">Invitation unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-500">This invitation is invalid, expired, canceled, or already accepted.</p></>}</section></main>;
}
