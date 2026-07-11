/**
 * Role-Based Access Control (RBAC)
 *
 * Implements strict permission gates for all commands and features
 * Roles: Admin, Teacher, Staff, Student, Parent
 */

const ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
  STAFF: "staff",
  STUDENT: "student",
  PARENT: "parent",
  NONE: "none",
};

class AccessControl {
  constructor(client) {
    this.client = client;
    this.ADMIN_ROLE_ID = process.env.TAMMY_ADMIN_ROLE_ID;
    this.TEACHER_ROLE_ID = process.env.TAMMY_TEACHER_ROLE_ID;
    this.STAFF_ROLE_ID = process.env.TAMMY_STAFF_ROLE_ID;
    this.STUDENT_ROLE_ID = process.env.TAMMY_STUDENT_ROLE_ID;
    this.PARENT_ROLE_ID = process.env.TAMMY_PARENT_ROLE_ID;
  }

  /**
   * Get user's highest role
   */
  async getUserRole(member) {
    if (!member) return ROLES.NONE;

    // Check admin
    if (member.roles.has(this.ADMIN_ROLE_ID)) return ROLES.ADMIN;
    // Check teacher
    if (member.roles.has(this.TEACHER_ROLE_ID)) return ROLES.TEACHER;
    // Check staff
    if (member.roles.has(this.STAFF_ROLE_ID)) return ROLES.STAFF;
    // Check student
    if (member.roles.has(this.STUDENT_ROLE_ID)) return ROLES.STUDENT;
    // Check parent
    if (member.roles.has(this.PARENT_ROLE_ID)) return ROLES.PARENT;

    return ROLES.NONE;
  }

  /**
   * Check if user has required role
   */
  async hasRole(member, requiredRoles) {
    const userRole = await this.getUserRole(member);
    return requiredRoles.includes(userRole);
  }

  /**
   * Get all roles (sorted by hierarchy)
   */
  async getUserRoles(member) {
    if (!member) return [];

    const roles = [];
    if (member.roles.has(this.ADMIN_ROLE_ID)) roles.push(ROLES.ADMIN);
    if (member.roles.has(this.TEACHER_ROLE_ID)) roles.push(ROLES.TEACHER);
    if (member.roles.has(this.STAFF_ROLE_ID)) roles.push(ROLES.STAFF);
    if (member.roles.has(this.STUDENT_ROLE_ID)) roles.push(ROLES.STUDENT);
    if (member.roles.has(this.PARENT_ROLE_ID)) roles.push(ROLES.PARENT);

    return roles;
  }

  /**
   * Check if user is staff (Teacher or Admin or Staff)
   */
  async isStaff(member) {
    const roles = await this.getUserRoles(member);
    return roles.some((r) => [ROLES.ADMIN, ROLES.TEACHER, ROLES.STAFF].includes(r));
  }

  /**
   * Check if user is student or staff
   */
  async isStudentOrStaff(member) {
    const roles = await this.getUserRoles(member);
    return roles.some((r) =>
      [ROLES.ADMIN, ROLES.TEACHER, ROLES.STAFF, ROLES.STUDENT].includes(r)
    );
  }

  /**
   * Command permission rules
   */
  static COMMAND_PERMISSIONS = {
    // Enrollment & Roster
    "academy-register": [ROLES.STAFF, ROLES.ADMIN],
    "academy-profile": [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN, ROLES.PARENT],
    "academy-roster": [ROLES.STAFF, ROLES.ADMIN],
    "academy-enrollment-status": [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN, ROLES.PARENT],

    // Assignments
    "assignment-create": [ROLES.TEACHER, ROLES.ADMIN],
    "assignment-view": [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN, ROLES.PARENT],
    "assignment-list": [ROLES.TEACHER, ROLES.ADMIN],

    // Submissions & Grading
    "view-submissions": [ROLES.TEACHER, ROLES.ADMIN],
    "grade-assignment": [ROLES.TEACHER, ROLES.ADMIN],
    "return-work": [ROLES.TEACHER, ROLES.ADMIN],
    "check-submission": [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN],

    // Announcements
    "announce": [ROLES.TEACHER, ROLES.ADMIN],
    "announce-list": [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN, ROLES.PARENT],

    // Attendance
    "check-in": [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN],
    "attendance-log": [ROLES.TEACHER, ROLES.ADMIN],
    "attendance-view": [ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN, ROLES.PARENT],

    // Parent Portal
    "student-status": [ROLES.PARENT, ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN],
    "view-assignments": [ROLES.PARENT, ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN],
    "view-grades": [ROLES.PARENT, ROLES.STUDENT, ROLES.STAFF, ROLES.ADMIN],

    // Teacher Thread Actions
    "class-status": [ROLES.TEACHER, ROLES.ADMIN],
    "flag-student": [ROLES.TEACHER, ROLES.ADMIN],
  };

  /**
   * Validate command access
   */
  static canAccessCommand(userRole, commandName) {
    const requiredRoles = this.COMMAND_PERMISSIONS[commandName];
    if (!requiredRoles) return false; // Command not found
    return requiredRoles.includes(userRole);
  }
}

module.exports = { AccessControl, ROLES };
