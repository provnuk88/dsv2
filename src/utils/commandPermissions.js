const { PermissionFlagsBits } = require('discord.js');
const logger = require('./logger');

function getCommandPermissions(commandType) {
  switch (commandType) {
    case 'admin':
      return { defaultMemberPermissions: PermissionFlagsBits.Administrator };
    case 'moderator':
      return {
        defaultMemberPermissions:
          PermissionFlagsBits.ManageEvents |
          PermissionFlagsBits.ManageMessages |
          PermissionFlagsBits.ModerateMembers
      };
    case 'user':
    default:
      return { defaultMemberPermissions: null };
  }
}

function applyPermissions(commandBuilder, commandType) {
  const permissions = getCommandPermissions(commandType);
  if (permissions.defaultMemberPermissions !== null) {
    commandBuilder.setDefaultMemberPermissions(permissions.defaultMemberPermissions);
  }
  logger.info(`Применены разрешения типа '${commandType}' к команде '${commandBuilder.name}'`);
  return commandBuilder;
}

function checkUserPermissions(interaction, commandType) {
  const member = interaction.member;
  if (!member) return false;
  switch (commandType) {
    case 'admin':
      return member.permissions.has(PermissionFlagsBits.Administrator);
    case 'moderator':
      return (
        member.permissions.has(PermissionFlagsBits.ManageEvents) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
        member.permissions.has(PermissionFlagsBits.Administrator)
      );
    case 'user':
    default:
      return true;
  }
}

function hasAdminPermission(member) {
  if (!member || !member.permissions) return false;
  // Лучше использовать PermissionFlagsBits.Administrator для совместимости
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

module.exports = {
  getCommandPermissions,
  applyPermissions,
  checkUserPermissions,
  hasAdminPermission
};