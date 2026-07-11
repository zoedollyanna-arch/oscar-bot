/**
 * Access Control Manager
 * Enforces role-based permissions for all Tammy Brightwood commands
 */

const ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
  STAFF: "staff",
  STUDENT: "student",
  PARENT: "parent",
};

// Command permission matrix
const COMMAND_PERMISSIONS = {
  // Enrollment commands
  "academy-register": [ROLES.STUDENT, ROLES.STAFF, ROLES.TEACHER, ROLES.ADMIN],
  "academy-profile": [ROLES.STUDENT, ROLES.PARENT],
  "academy-roster": [ROLES.TEACHER, ROLES.STAFF, ROLES.ADMIN],
  "academy-enrollment-status": [ROLES.STUDENT, ROLES.PARENT],

  // Assignment commands
  "assignment-create": [ROLES.TEACHER, ROLES.ADMIN],
  "assignment-view": [ROLES.STUDENT, ROLES.TEACHER, ROLES.STAFF],
  "assignment-list": [ROLES.STUDENT, ROLES.TEACHER, ROLES.STAFF],

  // Submission commands
  "submit-assignment": [ROLES.STUDENT],
  "view-submissions": [ROLES.TEACHER, ROLES.STAFF, ROLES.ADMIN],
  "grade-assignment": [ROLES.TEACHER, ROLES.ADMIN],
  "return-work": [ROLES.TEACHER, ROLES.ADMIN],

  // Attendance commands
  "check-in": [ROLES.STUDENT],
  "attendance-log": [ROLES.TEACHER, ROLES.STAFF, ROLES.ADMIN],
  "attendance-view": [ROLES.TEACHER, ROLES.STAFF, ROLES.ADMIN, ROLES.PARENT],

  // Announcement commands
  "announce": [ROLES.TEACHER, ROLES.STAFF, ROLES.ADMIN],
  "announce-list": [ROLES.STUDENT, ROLES.TEACHER, ROLES.STAFF],

  // Teacher thread commands
  "class-status": [ROLES.TEACHER, ROLES.STAFF, ROLES.ADMIN],
  "flag-student": [ROLES.TEACHER, ROLES.STAFF, ROLES.ADMIN],
  "add-student-note": [ROLES.STAFF, ROLES.ADMIN],

  // Portal commands
  "student-status": [ROLES.STUDENT, ROLES.PARENT],
  "view-grades": [ROLES.STUDENT, ROLES.PARENT],
  "view-assignments": [ROLES.STUDENT, ROLES.PARENT],
  "link-parent": [ROLES.STUDENT],
};

class AccessControl {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get user's role based on Discord roles
   */
  getUserRole(interaction) {
    if (!interaction.member) return null;

    const roleIds = interaction.member.roles.cache.map((r) => r.id);
    const adminRoleId = process.env.TAMMY_ADMIN_ROLE_ID;
    const teacherRoleId = process.env.TAMMY_TEACHER_ROLE_ID;
    const staffRoleIds = (process.env.TAMMY_STAFF_ROLE_IDS || "").split(",").filter(Boolean);
    const parentRoleId = process.env.TAMMY_PARENT_ROLE_ID;

    // Check roles in hierarchy
    if (adminRoleId && roleIds.includes(adminRoleId)) return ROLES.ADMIN;
    if (teacherRoleId && roleIds.includes(teacherRoleId)) return ROLES.TEACHER;
    if (staffRoleIds.some((id) => roleIds.includes(id))) return ROLES.STAFF;

    if (parentRoleId && roleIds.includes(parentRoleId)) return ROLES.PARENT;

    // Check if student (has academy role or registered)
    const studentRoleId = process.env.TAMMY_STUDENT_ROLE_ID;
    if (studentRoleId && roleIds.includes(studentRoleId)) return ROLES.STUDENT;

    // Default students can view their own data
    return ROLES.STUDENT;
  }

  /**
   * Check if user has required role
   */
  hasRole(interaction, requiredRoles) {
    if (!Array.isArray(requiredRoles)) requiredRoles = [requiredRoles];
    const userRole = this.getUserRole(interaction);
    return requiredRoles.includes(userRole);
  }

  /**
   * Check if user is staff (teacher or staff)
   */
  isStaff(interaction) {
    const role = this.getUserRole(interaction);
    return role === ROLES.TEACHER || role === ROLES.STAFF || role === ROLES.ADMIN;
  }

  /**
   * Check if user is admin
   */
  isAdmin(interaction) {
    return this.getUserRole(interaction) === ROLES.ADMIN;
  }

  /**
   * Enforce command permissions
   */
  async checkCommandPermission(interaction, commandName) {
    const requiredRoles = COMMAND_PERMISSIONS[commandName];
    if (!requiredRoles) return true; // No permission check needed

    if (!this.hasRole(interaction, requiredRoles)) {
      await interaction.reply({
        ephemeral: true,
        content: `❌ You don't have permission to use **/${commandName}**. Required role: ${requiredRoles.join(", ")}`,
      });
      return false;
    }

    return true;
  }
}

module.exports = { AccessControl, ROLES, COMMAND_PERMISSIONS };
