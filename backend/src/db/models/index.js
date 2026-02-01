import { User } from './User.js';
import { PrivacySettings } from './PrivacySettings.js';
import { Follow } from './Follow.js';
import { Blacklist } from './Blacklist.js';
import { BankSession } from './BankSession.js';
import { Bet } from './Bet.js';
import { Post } from './Post.js';
import { PostLike } from './PostLike.js';
import { PostComment } from './PostComment.js';
import { Dialog } from './Dialog.js';
import { DialogMember } from './DialogMember.js';
import { Message } from './Message.js';
import { Notification } from './Notification.js';

export function initModels(sequelize) {
  const models = {
    User: User(sequelize),
    PrivacySettings: PrivacySettings(sequelize),
    Follow: Follow(sequelize),
    Blacklist: Blacklist(sequelize),
    BankSession: BankSession(sequelize),
    Bet: Bet(sequelize),
    Post: Post(sequelize),
    PostLike: PostLike(sequelize),
    PostComment: PostComment(sequelize),
    Dialog: Dialog(sequelize),
    DialogMember: DialogMember(sequelize),
    Message: Message(sequelize),
    Notification: Notification(sequelize),
  };

  const { User: U, PrivacySettings: P, Follow: F, Blacklist: B, BankSession: S, Bet: T } = models;

  // Privacy 1:1
  U.hasOne(P, { as: 'Privacy', foreignKey: 'userId' });
  P.belongsTo(U, { foreignKey: 'userId' });

  // Follows (m:n self)
  U.belongsToMany(U, { as: 'Following', through: F, foreignKey: 'followerId', otherKey: 'followingId' });
  U.belongsToMany(U, { as: 'Followers', through: F, foreignKey: 'followingId', otherKey: 'followerId' });

  // Blacklist (m:n self)
  U.belongsToMany(U, { as: 'Blocked', through: B, foreignKey: 'ownerId', otherKey: 'blockedId' });
  U.belongsToMany(U, { as: 'BlockedBy', through: B, foreignKey: 'blockedId', otherKey: 'ownerId' });

  // Sessions
  U.hasMany(S, { as: 'Sessions', foreignKey: 'userId' });
  S.belongsTo(U, { as: 'Owner', foreignKey: 'userId' });

  // Bets
  S.hasMany(T, { as: 'Bets', foreignKey: 'sessionId' });
  T.belongsTo(S, { as: 'Session', foreignKey: 'sessionId' });
  const { Post: Pst, PostLike: PL, PostComment: PC, Bet: Bt } = models;

  // Posts
  U.hasMany(Pst, { as: 'Posts', foreignKey: 'authorId' });
  Pst.belongsTo(U, { as: 'Author', foreignKey: 'authorId' });

  // Repost self-ref
  Pst.belongsTo(Pst, { as: 'OriginalPost', foreignKey: 'originalPostId' });

  // Attached bet
  Pst.belongsTo(Bt, { as: 'AttachedBet', foreignKey: 'attachedBetId' });

  // Likes (m:n)
  U.belongsToMany(Pst, { as: 'LikedPosts', through: PL, foreignKey: 'userId', otherKey: 'postId' });
  Pst.belongsToMany(U, { as: 'Likers', through: PL, foreignKey: 'postId', otherKey: 'userId' });

  // Comments
  Pst.hasMany(PC, { as: 'Comments', foreignKey: 'postId' });
  PC.belongsTo(Pst, { foreignKey: 'postId' });

  U.hasMany(PC, { as: 'Comments', foreignKey: 'authorId' });
  PC.belongsTo(U, { as: 'Author', foreignKey: 'authorId' });

  const { Dialog: D, DialogMember: DM, Message: M } = models;

  // Dialog membership (m:n User<->Dialog)
  U.belongsToMany(D, { as: 'Dialogs', through: DM, foreignKey: 'userId', otherKey: 'dialogId' });
  D.belongsToMany(U, { as: 'Members', through: DM, foreignKey: 'dialogId', otherKey: 'userId' });

  D.hasMany(M, { as: 'Messages', foreignKey: 'dialogId' });
  M.belongsTo(D, { as: 'Dialog', foreignKey: 'dialogId' });

  U.hasMany(M, { as: 'SentMessages', foreignKey: 'senderId' });
  M.belongsTo(U, { as: 'Sender', foreignKey: 'senderId' });

  // используем уже объявленный выше Pst из блока Posts
  M.belongsTo(Pst, { as: 'SharedPost', foreignKey: 'sharedPostId' });
  DM.belongsTo(U, { as: 'User', foreignKey: 'userId' });
  
  const { Notification: N } = models;

  U.hasMany(N, { as: 'Notifications', foreignKey: 'userId' });
  N.belongsTo(U, { as: 'User', foreignKey: 'userId' });
  N.belongsTo(U, { as: 'Actor', foreignKey: 'actorId' });

  return models;
}
