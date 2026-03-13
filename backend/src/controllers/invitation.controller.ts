import crypto from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { Collaborator } from "../models/Collaborator.js";
import { Invitation } from "../models/Invitation.js";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";
import { sendInvitationMail } from "../services/mail.service.js";

const createInvitationSchema = z.object({
  invitedEmail: z.string().email(),
  role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function invitationExpired(invitation: { expiresAt: Date }) {
  return invitation.expiresAt.getTime() <= Date.now();
}

export async function createInvitation(request: Request, response: Response) {
  const input = createInvitationSchema.parse(request.body);
  const projectId = request.params.id;
  const inviterId = request.user!.userId;
  const invitedEmail = normalizeEmail(input.invitedEmail);

  const [project, inviter, invitedUser] = await Promise.all([
    Project.findById(projectId).select("_id name ownerId").lean(),
    User.findById(inviterId).select("_id username email").lean(),
    User.findOne({ email: invitedEmail }).select("_id email").lean(),
  ]);

  if (!project) {
    return response.status(404).json({ message: "Project not found" });
  }
  if (!inviter) {
    return response.status(404).json({ message: "Inviter not found" });
  }
  if (normalizeEmail(inviter.email) === invitedEmail) {
    return response.status(400).json({ message: "You cannot invite yourself." });
  }

  const existingCollab = invitedUser
    ? await Collaborator.findOne({ projectId, userId: invitedUser._id }).lean()
    : null;
  if (existingCollab) {
    return response.status(409).json({ message: "User is already a collaborator." });
  }

  let invitation = await Invitation.findOne({
    projectId,
    invitedEmail,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });

  if (!invitation) {
    invitation = await Invitation.create({
      projectId,
      invitedBy: inviterId,
      invitedEmail,
      invitedUserId: invitedUser?._id,
      role: input.role,
      token: crypto.randomBytes(32).toString("hex"),
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  } else {
    invitation = await Invitation.findByIdAndUpdate(
      invitation._id,
      {
        role: input.role,
        invitedBy: inviterId,
        invitedUserId: invitedUser?._id,
      },
      { new: true },
    );
    if (!invitation) {
      return response.status(404).json({ message: "Invitation not found." });
    }
  }

  const inviteLink = `${env.CLIENT_ORIGIN}/invite/accept?token=${invitation.token}`;
  await sendInvitationMail({
    to: invitedEmail,
    projectName: project.name,
    inviterName: inviter.username,
    role: input.role,
    inviteLink,
  });

  return response.status(201).json({
    data: {
      invitationId: invitation._id,
      status: invitation.status,
      inviteLink,
      expiresAt: invitation.expiresAt,
    },
  });
}

export async function listProjectMembers(request: Request, response: Response) {
  const projectId = request.params.id;
  const project = await Project.findById(projectId).select("_id ownerId").lean();
  if (!project) {
    return response.status(404).json({ message: "Project not found" });
  }

  const [owner, collaborators] = await Promise.all([
    User.findById(project.ownerId).select("_id username email avatar").lean(),
    Collaborator.find({ projectId })
      .populate("userId", "_id username email avatar")
      .lean(),
  ]);

  return response.json({
    data: {
      owner: owner
        ? {
            id: owner._id,
            username: owner.username,
            email: owner.email,
            avatar: owner.avatar,
            role: "owner",
          }
        : null,
      collaborators: collaborators
        .filter((collab) => collab.userId && String((collab.userId as any)._id) !== String(project.ownerId))
        .map((collab) => ({
          id: (collab.userId as any)._id,
          username: (collab.userId as any).username,
          email: (collab.userId as any).email,
          avatar: (collab.userId as any).avatar,
          role: collab.role,
          joinedAt: collab.joinedAt,
        })),
    },
  });
}

export async function listPendingInvitations(request: Request, response: Response) {
  const projectId = request.params.id;
  const invitations = await Invitation.find({
    projectId,
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .select("_id invitedEmail role invitedBy expiresAt createdAt")
    .lean();

  return response.json({ data: invitations });
}

export async function validateInvitation(request: Request, response: Response) {
  const token = z.string().min(16).parse(request.query.token);
  const invitation = await Invitation.findOne({ token })
    .populate("projectId", "_id name")
    .populate("invitedBy", "_id username")
    .lean();

  if (!invitation || invitation.status !== "pending" || invitationExpired(invitation)) {
    if (invitation && invitation.status === "pending" && invitationExpired(invitation)) {
      await Invitation.findByIdAndUpdate(invitation._id, { status: "expired" });
    }
    return response.json({ data: { valid: false } });
  }

  return response.json({
    data: {
      valid: true,
      invitation: {
        token: invitation.token,
        role: invitation.role,
        invitedEmail: invitation.invitedEmail,
        expiresAt: invitation.expiresAt,
        project: invitation.projectId
          ? {
              id: (invitation.projectId as any)._id,
              name: (invitation.projectId as any).name,
            }
          : null,
        invitedBy: invitation.invitedBy
          ? {
              id: (invitation.invitedBy as any)._id,
              username: (invitation.invitedBy as any).username,
            }
          : null,
      },
    },
  });
}

export async function acceptInvitation(request: Request, response: Response) {
  const token = z.object({ token: z.string().min(16) }).parse(request.body).token;
  const userId = request.user!.userId;

  const [user, invitation] = await Promise.all([
    User.findById(userId).select("_id email username").lean(),
    Invitation.findOne({ token, status: "pending" }).lean(),
  ]);

  if (!user) {
    return response.status(404).json({ message: "User not found" });
  }
  if (!invitation || invitationExpired(invitation)) {
    if (invitation && invitation.status === "pending" && invitationExpired(invitation)) {
      await Invitation.findByIdAndUpdate(invitation._id, { status: "expired" });
    }
    return response.status(400).json({ message: "Invitation is invalid or expired." });
  }

  const emailMatches = normalizeEmail(user.email) === normalizeEmail(invitation.invitedEmail);
  const userMatches = invitation.invitedUserId ? String(invitation.invitedUserId) === String(user._id) : false;

  if (!emailMatches && !userMatches) {
    return response.status(403).json({ message: "This invitation is not for your account." });
  }

  await Collaborator.findOneAndUpdate(
    { projectId: invitation.projectId, userId: user._id },
    {
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      joinedAt: new Date(),
    },
    { upsert: true, new: true },
  );

  await Invitation.findByIdAndUpdate(invitation._id, {
    status: "accepted",
    invitedUserId: user._id,
  });

  return response.json({
    data: {
      accepted: true,
      projectId: invitation.projectId,
      role: invitation.role,
    },
  });
}
